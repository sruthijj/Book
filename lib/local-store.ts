import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CreateBook, TextSegment } from '@/types';

export interface StoredBook {
  id: string;
  title: string;
  slug: string;
  author: string;
  persona: string | null;
  fileURL: string;
  fileBlobKey: string;
  coverURL: string | null;
  coverBlobKey: string | null;
  fileSize: number;
  totalSegments: number;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredSegment {
  id: string;
  bookId: string;
  content: string;
  segmentIndex: number;
  pageNumber?: number | null;
  wordCount: number;
}

const DATA_DIR =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join('/tmp', '.data')
    : path.join(process.cwd(), '.data');
const BOOKS_FILE = path.join(DATA_DIR, 'books.json');
const SEGMENTS_FILE = path.join(DATA_DIR, 'segments.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create .data directory:', err);
  }
}

export function getLocalBooks(): StoredBook[] {
  ensureDataDir();
  try {
    if (fs.existsSync(BOOKS_FILE)) {
      const data = fs.readFileSync(BOOKS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.warn('Error reading local books:', err);
  }
  return [];
}

export function saveLocalBook(data: CreateBook, slug: string): StoredBook {
  ensureDataDir();
  const books = getLocalBooks();
  
  // Check if book already exists
  const existing = books.find((b) => b.slug === slug);
  if (existing) {
    return existing;
  }

  const newBook: StoredBook = {
    id: crypto.randomUUID(),
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
    userId: data.clerkId || 'guest',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  books.unshift(newBook);

  try {
    fs.writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write local books:', err);
  }

  return newBook;
}

export function getLocalBookBySlug(slug: string): StoredBook | null {
  const books = getLocalBooks();
  return books.find((b) => b.slug === slug) || null;
}

export function saveLocalSegments(bookId: string, segments: TextSegment[]) {
  ensureDataDir();
  let allSegments: StoredSegment[] = [];

  try {
    if (fs.existsSync(SEGMENTS_FILE)) {
      const raw = fs.readFileSync(SEGMENTS_FILE, 'utf-8');
      allSegments = JSON.parse(raw);
    }
  } catch {
    allSegments = [];
  }

  // Remove existing segments for this book
  allSegments = allSegments.filter((s) => s.bookId !== bookId);

  // Add new segments
  const newSegments: StoredSegment[] = segments.map((s) => ({
    id: crypto.randomUUID(),
    bookId,
    content: s.text,
    segmentIndex: s.segmentIndex,
    pageNumber: s.pageNumber ?? null,
    wordCount: s.wordCount,
  }));

  allSegments.push(...newSegments);

  try {
    fs.writeFileSync(SEGMENTS_FILE, JSON.stringify(allSegments, null, 2), 'utf-8');

    // Update book totalSegments
    const books = getLocalBooks();
    const targetBook = books.find((b) => b.id === bookId);
    if (targetBook) {
      targetBook.totalSegments = segments.length;
      fs.writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Failed to write local segments:', err);
  }
}

export function searchLocalSegments(bookId: string, query: string, limit: number = 5): StoredSegment[] {
  ensureDataDir();
  try {
    if (!fs.existsSync(SEGMENTS_FILE)) return [];

    const raw = fs.readFileSync(SEGMENTS_FILE, 'utf-8');
    const allSegments: StoredSegment[] = JSON.parse(raw);
    const bookSegments = allSegments.filter((s) => s.bookId === bookId);

    if (bookSegments.length === 0) return [];

    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (keywords.length === 0) {
      return bookSegments.slice(0, limit);
    }

    // Rank segments by keyword matches
    const scored = bookSegments.map((segment) => {
      const textLower = segment.content.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (textLower.includes(kw)) {
          score += 1;
        }
      }
      return { segment, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored
      .filter((item) => item.score > 0)
      .slice(0, limit)
      .map((item) => item.segment);
  } catch (err) {
    console.error('Error searching local segments:', err);
    return [];
  }
}
