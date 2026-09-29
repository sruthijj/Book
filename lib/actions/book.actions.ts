'use server';

import { revalidatePath } from "next/cache";
import { eq, or, ilike, sql, count, desc } from "drizzle-orm";
import { CreateBook, TextSegment } from "@/types";
import { db } from "@/db";
import { books, bookSegments } from "@/db/schema";
import { generateSlug, serializeData } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import { sampleBooks } from "@/lib/constants";
import { getUserPlan } from "../subscription.server";
import { PLAN_LIMITS } from "../subscription-constants";
import {
  getLocalBooks,
  saveLocalBook,
  getLocalBookBySlug,
  saveLocalSegments,
  searchLocalSegments,
} from "@/lib/local-store";

export const getAllBooks = async (search?: string) => {
    try {
        let whereCondition = undefined;

        if (search) {
            const pattern = `%${search}%`;
            whereCondition = or(
                ilike(books.title, pattern),
                ilike(books.author, pattern)
            );
        }

        const query = db
            .select()
            .from(books)
            .orderBy(desc(books.createdAt));

        const result = whereCondition
            ? await query.where(whereCondition)
            : await query;

        const dbBooks = serializeData(result) || [];
        const localBooks = getLocalBooks() || [];

        // Combine DB books with any local offline books
        const combined = [...dbBooks];
        for (const lb of localBooks) {
            if (!combined.some((b) => b.slug === lb.slug)) {
                combined.unshift(lb);
            }
        }

        return {
            success: true,
            data: combined,
        };
    } catch (e: any) {
        console.warn('Database query failed in getAllBooks, using local storage:', e?.message);
        const localBooks = getLocalBooks();
        return {
            success: true,
            data: serializeData(localBooks),
        };
    }
};

export const checkBookExists = async (title: string) => {
    try {
        const slug = generateSlug(title);

        try {
            const existingBook = await db
                .select()
                .from(books)
                .where(eq(books.slug, slug))
                .limit(1);

            if (existingBook.length > 0) {
                return {
                    exists: true,
                    book: serializeData(existingBook[0]),
                };
            }
        } catch {
            // Check local store if database is offline
            const local = getLocalBookBySlug(slug);
            if (local) {
                return {
                    exists: true,
                    book: serializeData(local),
                };
            }
        }

        return {
            exists: false,
        };
    } catch (e: any) {
        console.error('Error checking book exists', e);
        return {
            exists: false,
            error: e.message || 'Failed to check book status',
        };
    }
};

export const createBook = async (data: CreateBook) => {
    const slug = generateSlug(data.title);

    try {
        // Attempt PostgreSQL insertion first
        const existingBook = await db
            .select()
            .from(books)
            .where(eq(books.slug, slug))
            .limit(1);

        if (existingBook.length > 0) {
            return {
                success: true,
                data: serializeData(existingBook[0]),
                alreadyExists: true,
            };
        }

        const plan = await getUserPlan();
        const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];

        const [bookCountResult] = await db
            .select({ count: count() })
            .from(books);

        const bookCount = Number(bookCountResult?.count || 0);

        if (bookCount >= limits.maxBooks) {
        try { revalidatePath("/"); } catch { /* ignore outside request context */ }

            return {
                success: false,
                error: `You have reached the maximum number of books allowed for your ${plan} plan (${limits.maxBooks}).`,
                isBillingError: true,
            };
        }

        const currentUser = await getCurrentUser();

        const [newBook] = await db
            .insert(books)
            .values({
                title: data.title,
                slug,
                author: data.author,
                persona: data.persona || null,
                fileURL: data.fileURL,
                fileBlobKey: data.fileBlobKey,
                coverURL: data.coverURL || null,
                coverBlobKey: data.coverBlobKey || null,
                fileSize: data.fileSize,
                totalSegments: 0,
                userId: currentUser?.id || data.clerkId || 'guest',
            })
            .returning();

        try { revalidatePath("/"); } catch { /* ignore outside request context */ }

        return {
            success: true,
            data: serializeData(newBook),
        };
    } catch (e: any) {
        console.warn('PostgreSQL database unavailable, saving book to local storage fallback:', e.message);

        // Fallback: save book into local file storage
        const localBook = saveLocalBook(data, slug);
        try { revalidatePath("/"); } catch { /* ignore outside request context */ }

        return {
            success: true,
            data: serializeData(localBook),
        };
    }
};

export const getBookBySlug = async (slug: string) => {
    try {
        let book = null;
        try {
            const result = await db
                .select()
                .from(books)
                .where(eq(books.slug, slug))
                .limit(1);
            if (result.length > 0) {
                book = result[0];
            }
        } catch (dbErr) {
            console.warn('Database query failed in getBookBySlug, checking local and sample books:', dbErr);
        }

        // If not in database, check local store
        if (!book) {
            const local = getLocalBookBySlug(slug);
            if (local) {
                return {
                    success: true,
                    data: serializeData(local),
                };
            }
        }

        if (!book) {
            // Check sample books fallback
            const sample = sampleBooks.find((b) => b.slug === slug);
            if (sample) {
                return {
                    success: true,
                    data: {
                        id: sample._id,
                        title: sample.title,
                        author: sample.author,
                        slug: sample.slug,
                        coverURL: sample.coverURL,
                        persona: 'rachel',
                        fileSize: 1024 * 1024 * 5,
                        totalSegments: 120,
                        createdAt: new Date(),
                    },
                };
            }

            return { success: false, error: 'Book not found' };
        }

        return {
            success: true,
            data: serializeData(book),
        };
    } catch (e: any) {
        console.error('Error fetching book by slug', e);
        return {
            success: false,
            error: e.message || 'Failed to fetch book details',
        };
    }
};

export const saveBookSegments = async (
    bookId: string,
    clerkIdOrSegments: string | TextSegment[],
    maybeSegments?: TextSegment[]
) => {
    const segments: TextSegment[] = Array.isArray(clerkIdOrSegments)
        ? clerkIdOrSegments
        : (maybeSegments || []);

    const userId: string = typeof clerkIdOrSegments === 'string'
        ? clerkIdOrSegments
        : 'guest';

    if (segments.length === 0) {
        return { success: true, data: { segmentsCreated: 0 } };
    }

    try {
        console.log('Saving book segments to PostgreSQL...');

        const segmentsToInsert = segments.map(({ text, segmentIndex, pageNumber, wordCount }) => ({
            bookId,
            userId,
            content: text,
            segmentIndex,
            pageNumber: pageNumber ?? null,
            wordCount,
        }));

        const CHUNK_SIZE = 100;
        for (let i = 0; i < segmentsToInsert.length; i += CHUNK_SIZE) {
            const chunk = segmentsToInsert.slice(i, i + CHUNK_SIZE);
            await db.insert(bookSegments).values(chunk);
        }

        await db
            .update(books)
            .set({ totalSegments: segments.length })
            .where(eq(books.id, bookId));

        console.log('Book segments saved to PostgreSQL successfully.');

        return {
            success: true,
            data: { segmentsCreated: segments.length },
        };
    } catch (e: any) {
        console.warn('PostgreSQL unavailable, saving segments to local store fallback:', e.message);

        // Save segments to local store so AI RAG search can still query them
        saveLocalSegments(bookId, segments);

        return {
            success: true,
            data: { segmentsCreated: segments.length },
        };
    }
};

export const searchBookSegments = async (bookId: string, query: string, limit: number = 5) => {
    try {
        console.log(`Searching for: "${query}" in book ${bookId}`);

        // Try PostgreSQL full-text search with plainto_tsquery
        try {
            const ftsResults = await db
                .select({
                    id: bookSegments.id,
                    bookId: bookSegments.bookId,
                    content: bookSegments.content,
                    segmentIndex: bookSegments.segmentIndex,
                    pageNumber: bookSegments.pageNumber,
                    wordCount: bookSegments.wordCount,
                })
                .from(bookSegments)
                .where(
                    sql`${bookSegments.bookId} = ${bookId} AND to_tsvector('english', ${bookSegments.content}) @@ plainto_tsquery('english', ${query})`
                )
                .limit(limit);

            if (ftsResults.length > 0) {
                console.log(`FTS search complete. Found ${ftsResults.length} results`);
                return {
                    success: true,
                    data: serializeData(ftsResults),
                };
            }
        } catch {
            // Fall through to keyword ILIKE search if FTS query encounters syntax anomaly
        }

        // Fallback: ILIKE search with keyword matching in DB
        try {
            const keywords = query.split(/\s+/).filter((k) => k.length > 2);
            const whereConditions = keywords.map((k) => ilike(bookSegments.content, `%${k}%`));

            const fallbackResults = await db
                .select({
                    id: bookSegments.id,
                    bookId: bookSegments.bookId,
                    content: bookSegments.content,
                    segmentIndex: bookSegments.segmentIndex,
                    pageNumber: bookSegments.pageNumber,
                    wordCount: bookSegments.wordCount,
                })
                .from(bookSegments)
                .where(
                    whereConditions.length > 0
                        ? sql`${bookSegments.bookId} = ${bookId} AND (${or(...whereConditions)})`
                        : eq(bookSegments.bookId, bookId)
                )
                .orderBy(bookSegments.segmentIndex)
                .limit(limit);

            if (fallbackResults.length > 0) {
                return {
                    success: true,
                    data: serializeData(fallbackResults),
                };
            }
        } catch {
            // DB failed, fall through to local store search
        }

        // Fallback: search local storage segments
        const localResults = searchLocalSegments(bookId, query, limit);
        if (localResults.length > 0) {
            console.log(`Local search complete. Found ${localResults.length} results`);
            return {
                success: true,
                data: serializeData(localResults),
            };
        }

        return {
            success: true,
            data: [],
        };
    } catch (error) {
        console.error('Error searching segments:', error);
        return {
            success: true,
            data: [],
        };
    }
};