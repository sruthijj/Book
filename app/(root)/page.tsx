import React from 'react';
import HeroSection from "@/components/HeroSection";
import { sampleBooks } from "@/lib/constants";
import BookCard from "@/components/BookCard";
import { getAllBooks } from "@/lib/actions/book.actions";

export const dynamic = 'force-dynamic';

interface DisplayBook {
  id: string;
  title: string;
  author: string;
  slug: string;
  coverURL: string;
  isCustomBook: boolean;
}

const Page = async () => {
  const res = await getAllBooks();
  const dbBooks: DisplayBook[] = (res.success && res.data ? res.data : []).map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    slug: b.slug,
    coverURL: b.coverURL || '',
    isCustomBook: true,
  }));

  // Combine Neon DB books with sample books (ensuring no duplicate slugs)
  const displayBooks: DisplayBook[] = [...dbBooks];
  for (const sample of sampleBooks) {
    if (!displayBooks.some((b) => b.slug === sample.slug)) {
      displayBooks.push({
        id: sample._id,
        title: sample.title,
        author: sample.author,
        slug: sample.slug,
        coverURL: sample.coverURL,
        isCustomBook: false,
      });
    }
  }

  return (
    <main className="pt-20 sm:pt-24 pb-16 min-h-screen">
      <HeroSection />

      <div className="library-hero-grid">
        {displayBooks.map((book) => (
          <BookCard
            key={book.id || book.slug}
            id={book.id}
            title={book.title}
            author={book.author}
            coverURL={book.coverURL}
            slug={book.slug}
            isCustomBook={book.isCustomBook}
          />
        ))}
      </div>
    </main>
  );
};

export default Page;