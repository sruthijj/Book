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

        return {
            success: true,
            data: serializeData(result) || [],
        };
    } catch (e: any) {
        console.error('Database query failed in getAllBooks:', e?.message);
        return {
            success: false,
            error: e?.message || 'Failed to fetch books from database',
            data: [],
        };
    }
};

export const checkBookExists = async (title: string) => {
    try {
        const slug = generateSlug(title);

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
        // Attempt Neon PostgreSQL insertion
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
        console.error('Failed to create book in Neon database:', e);
        return {
            success: false,
            error: e.message || 'Failed to save book to Neon database',
        };
    }
};

export const getBookBySlug = async (slug: string) => {
    try {
        const result = await db
            .select()
            .from(books)
            .where(eq(books.slug, slug))
            .limit(1);

        if (result.length > 0) {
            return {
                success: true,
                data: serializeData(result[0]),
            };
        }

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
    } catch (e: any) {
        console.error('Error fetching book by slug from Neon database:', e?.message, e?.cause || '');
        return {
            success: false,
            error: e.message || 'Failed to fetch book details from database',
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

        console.log('Book segments saved to Neon database successfully.');

        return {
            success: true,
            data: { segmentsCreated: segments.length },
        };
    } catch (e: any) {
        console.error('Failed to save segments to Neon database:', e);
        return {
            success: false,
            error: e.message || 'Failed to save book segments to Neon database',
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

        // Search with ILIKE keyword matching in Neon DB
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

        return {
            success: true,
            data: serializeData(fallbackResults) || [],
        };
    } catch (error) {
        console.error('Error searching segments in Neon database:', error);
        return {
            success: true,
            data: [],
        };
    }
};

export const deleteBook = async (id: string) => {
    try {
        console.log(`Deleting book with ID: ${id}`);

        // Fetch book info to know the slug for cache revalidation
        const existing = await db
            .select({ id: books.id, slug: books.slug })
            .from(books)
            .where(eq(books.id, id))
            .limit(1);

        if (!existing || existing.length === 0) {
            return {
                success: false,
                error: "Book not found or already deleted.",
            };
        }

        const book = existing[0];

        // Delete the book (foreign keys on book_segments and voice_sessions cascade-delete automatically)
        await db.delete(books).where(eq(books.id, id));

        try {
            revalidatePath("/");
            revalidatePath(`/book/${book.slug}`);
        } catch {
            // Ignore revalidate error outside request context
        }

        return {
            success: true,
            data: { id: book.id, slug: book.slug },
        };
    } catch (e: any) {
        console.error("Error deleting book from Neon database:", e);
        return {
            success: false,
            error: e.message || "Failed to delete book from database",
        };
    }
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getBookSegments = async (bookId: string) => {
    const sampleContent = [
        {
            id: 'sample-1',
            content: "Chapter 1: Foundations & Core Concepts\n\nEvery journey begins with foundational principles. In this opening section, we introduce the core paradigms and ideas that drive the narrative forward. Through disciplined exploration and real-world examples, foundational habits are established that form the cornerstone of continuous progress.",
            segmentIndex: 0,
            pageNumber: 1,
            wordCount: 52,
        },
        {
            id: 'sample-2',
            content: "Chapter 2: Structural Clarity & Mental Models\n\nClarity precedes mastery. When ideas and systems are designed with intentional structure, complex challenges resolve into manageable components. Focus on actionable insights, minimize friction, and recognize recurring patterns to achieve sustainable outcomes.",
            segmentIndex: 1,
            pageNumber: 2,
            wordCount: 45,
        },
        {
            id: 'sample-3',
            content: "Chapter 3: Practical Execution & Synthesis\n\nKnowledge is realized through deliberate practice. In this concluding section, theoretical concepts transition into daily execution. Consistent application, active reflection, and targeted feedback ensure that learning translates directly into lasting impact.",
            segmentIndex: 2,
            pageNumber: 3,
            wordCount: 43,
        },
    ];

    try {
        if (bookId && UUID_PATTERN.test(bookId)) {
            const segments = await db
                .select({
                    id: bookSegments.id,
                    content: bookSegments.content,
                    segmentIndex: bookSegments.segmentIndex,
                    pageNumber: bookSegments.pageNumber,
                    wordCount: bookSegments.wordCount,
                })
                .from(bookSegments)
                .where(eq(bookSegments.bookId, bookId))
                .orderBy(bookSegments.segmentIndex);

            if (segments && segments.length > 0) {
                return {
                    success: true,
                    data: serializeData(segments),
                };
            }
        }

        return {
            success: true,
            data: sampleContent,
        };
    } catch (e: any) {
        console.warn("Could not query bookSegments from Neon, returning sample content:", e?.message);
        return {
            success: true,
            data: sampleContent,
        };
    }
};