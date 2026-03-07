'use server';

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";

import { CreateBook, TextSegment } from "@/types";
import { connectToDatabase } from "@/Database/mongoose";
import { escapeRegex, generateSlug, serializeData } from "@/lib/utils";
import Book from "@/Database/Models/book.model";
import BookSegment from "@/Database/Models/book-segment.model";
import { getUserPlan } from "../subscription.server";
import { PLAN_LIMITS } from "../subscription-constants";

export const getAllBooks = async (search?: string) => {
    try {
        await connectToDatabase();

        const { userId } = await auth();

        if (!userId) {
            return { success: false, error: "Unauthorized" };
        }

        let query: any = { clerkId: userId };

        if (search) {
            const escapedSearch = escapeRegex(search);
            const regex = new RegExp(escapedSearch, 'i');
            query.$or = [
                { title: { $regex: regex } },
                { author: { $regex: regex } },
            ];
        }

        const books = await Book.find(query).sort({ createdAt: -1 }).lean();

        return {
            success: true,
            data: serializeData(books)
        }
    } catch (e: any) {
        console.error('Error connecting to database', e);
        return {
            success: false,
            error: e.message || 'Failed to fetch books'
        }
    }
}

export const checkBookExists = async (title: string) => {
    try {
        await connectToDatabase();
        const { userId } = await auth();

        if (!userId) return { exists: false };

        const slug = generateSlug(title);

        const existingBook = await Book.findOne({ slug, clerkId: userId }).lean();

        if (existingBook) {
            return {
                exists: true,
                book: serializeData(existingBook)
            }
        }

        return {
            exists: false,
        }
    } catch (e: any) {
        console.error('Error checking book exists', e);
        return {
            exists: false,
            error: e.message || 'Failed to check book status'
        }
    }
}

export const createBook = async (data: CreateBook) => {
    try {
        await connectToDatabase();

        const { userId } = await auth();

        if (!userId) {
            return { success: false, error: "Unauthorized" };
        }

        const slug = generateSlug(data.title);

        const existingBook = await Book.findOne({ slug, clerkId: userId }).lean();

        if (existingBook) {
            return {
                success: true,
                data: serializeData(existingBook),
                alreadyExists: true,
            }
        }

        const plan = await getUserPlan();
        const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];

        const bookCount = await Book.countDocuments({ clerkId: userId });

        if (bookCount >= limits.maxBooks) {
            revalidatePath("/");

            return {
                success: false,
                error: `You have reached the maximum number of books allowed for your ${plan} plan (${limits.maxBooks}). Please upgrade to add more books.`,
                isBillingError: true,
            };
        }

        const book = await Book.create({
            ...data,
            clerkId: userId,
            slug,
            totalSegments: 0
        });

        revalidatePath("/");

        return {
            success: true,
            data: serializeData(book),
        }
    } catch (e: any) {
        console.error('Error creating a book', e);

        return {
            success: false,
            error: e.message || 'Failed to create book',
        }
    }
}

export const getBookBySlug = async (slug: string) => {
    try {
        await connectToDatabase();
        const { userId } = await auth();

        if (!userId) {
            return { success: false, error: 'Unauthorized' };
        }

        const book = await Book.findOne({ slug, clerkId: userId }).lean();

        if (!book) {
            return { success: false, error: 'Book not found' };
        }

        return {
            success: true,
            data: serializeData(book)
        }
    } catch (e: any) {
        console.error('Error fetching book by slug', e);
        return {
            success: false,
            error: e.message || 'Failed to fetch book details'
        }
    }
}

export const saveBookSegments = async (bookId: string, clerkId: string, segments: TextSegment[]) => {
    try {
        await connectToDatabase();
        const { userId } = await auth();

        if (!userId || userId !== clerkId) {
            return { success: false, error: "Unauthorized" };
        }

        console.log('Saving book segments...');

        const segmentsToInsert = segments.map(({ text, segmentIndex, pageNumber, wordCount }) => ({
            clerkId: userId,
            bookId: new mongoose.Types.ObjectId(bookId),
            content: text,
            segmentIndex,
            pageNumber,
            wordCount
        }));

        await BookSegment.insertMany(segmentsToInsert);

        await Book.findByIdAndUpdate(bookId, { totalSegments: segments.length });

        console.log('Book segments saved successfully.');

        return {
            success: true,
            data: { segmentsCreated: segments.length }
        }
    } catch (e: any) {
        console.error('Error saving book segments', e);

        return {
            success: false,
            error: e.message || 'Failed to save book segments',
        }
    }
}

// Searches book segments using MongoDB text search with regex fallback
export const searchBookSegments = async (bookId: string, query: string, limit: number = 5) => {
    try {
        await connectToDatabase();

        console.log(`Searching for: "${query}" in book ${bookId}`);

        const bookObjectId = new mongoose.Types.ObjectId(bookId);

        const { userId } = await auth();
        if (!userId) return { success: false, data: [] };

        // Try MongoDB text search first (requires text index)
        let segments: Record<string, unknown>[] = [];
        try {
            segments = await BookSegment.find({
                bookId: bookObjectId,
                clerkId: userId,
                $text: { $search: query },
            })
                .select('_id bookId content segmentIndex pageNumber wordCount')
                .sort({ score: { $meta: 'textScore' } })
                .limit(limit)
                .lean();
        } catch {
            // Text index may not exist — fall through to regex fallback
            segments = [];
        }

        // Fallback: regex search matching ANY keyword
        if (segments.length === 0) {
            const keywords = query.split(/\s+/).filter((k) => k.length > 2);

            if (keywords.length > 0) {
                const pattern = keywords.map(escapeRegex).join('|');

                segments = await BookSegment.find({
                    bookId: bookObjectId,
                    clerkId: userId,
                    content: { $regex: pattern, $options: 'i' },
                })
                    .select('_id bookId content segmentIndex pageNumber wordCount')
                    .sort({ segmentIndex: 1 })
                    .limit(limit)
                    .lean();
            }
        }

        console.log(`Search complete. Found ${segments.length} results`);

        return {
            success: true,
            data: serializeData(segments),
        };
    } catch (error) {
        console.error('Error searching segments:', error);
        return {
            success: false,
            error: (error as Error).message,
            data: [],
        };
    }
};