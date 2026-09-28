import React from 'react'
import HeroSection from "@/components/HeroSection";
import { sampleBooks } from "@/lib/constants";
import BookCard from "@/components/BookCard";

const Page = () => {
  return (
    <main className="pt-20 sm:pt-24 pb-16 min-h-screen">
      <HeroSection />

      <div className="library-hero-grid">
        {sampleBooks.map((book) => (
          <BookCard key={book._id} title={book.title} author={book.author} coverURL={book.coverURL}
            slug={book.slug} />
        ))}
      </div>
    </main>
  )
}

export default Page