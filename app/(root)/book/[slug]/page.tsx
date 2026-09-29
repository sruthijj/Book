import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Layers, Volume2 } from 'lucide-react';
import { getBookBySlug } from '@/lib/actions/book.actions';
import { getVoice } from '@/lib/utils';
import BookChat from '@/components/BookChat';
import VoiceCallButton from '@/components/VoiceCallButton';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function BookDetailsPage({ params }: PageProps) {
  const { slug } = await params;
  const res = await getBookBySlug(slug);

  if (!res.success || !res.data) {
    return (
      <main className="min-h-screen pt-28 pb-20 wrapper flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-serif font-bold text-[#1C1C1C] mb-4">Book Not Found</h1>
        <p className="text-[#6B6B6B] mb-6">
          The requested book could not be found or has not been uploaded yet.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-[#663820] text-white text-sm font-semibold hover:bg-[#4d2814] transition-all"
        >
          Return to Library
        </Link>
      </main>
    );
  }

  const book = res.data;
  const voice = getVoice(book.persona || undefined);

  return (
    <main className="min-h-screen pt-24 sm:pt-28 pb-20 wrapper">
      
      {/* Back to Library Navigation */}
      <div className="mb-6 sm:mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#663820] hover:text-[#4d2814] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Library</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        
        {/* Left Column: Book Details Card */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E9E1CC] shadow-xs">
            
            {/* Book Cover */}
            <div className="relative aspect-[3/4] w-full max-w-[280px] mx-auto overflow-hidden rounded-2xl bg-[#F5F0E1] border border-[#E9E1CC] shadow-md mb-6">
              {book.coverURL ? (
                <Image
                  src={book.coverURL}
                  alt={book.title}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-[#6B6B6B]">
                  <Layers className="w-12 h-12 text-[#663820] mb-2" />
                  <span className="font-serif font-bold text-lg text-[#1C1C1C]">{book.title}</span>
                </div>
              )}
            </div>

            {/* Book Metadata */}
            <div className="text-center sm:text-left space-y-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1C1C1C] leading-snug">
                  {book.title}
                </h1>
                <p className="text-base text-[#6B6B6B] font-medium italic mt-1">
                  by {book.author}
                </p>
              </div>

              {/* Info Badges */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-2xl bg-[#FFF9ED] border border-[#E9E1CC] flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-[#663820] flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-[#A89F8F] uppercase font-bold tracking-wider">Voice</span>
                    <span className="text-xs font-semibold text-[#1C1C1C] truncate">{voice.name}</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#FFF9ED] border border-[#E9E1CC] flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-[#663820] flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-[#A89F8F] uppercase font-bold tracking-wider">Segments</span>
                    <span className="text-xs font-semibold text-[#1C1C1C] truncate">
                      {book.totalSegments || 0} Indexed
                    </span>
                  </div>
                </div>
              </div>

              {/* Persona Description */}
              <div className="p-4 rounded-2xl bg-[#F5F0E1]/50 border border-[#E9E1CC] text-xs text-[#4A4A4A] leading-relaxed">
                <span className="font-bold text-[#1C1C1C] block mb-0.5">Selected Persona:</span>
                {voice.description}
              </div>

              {/* Voice Call Action Button (Vapi Voice Agent) */}
              <VoiceCallButton
                bookId={book.id}
                bookTitle={book.title}
                author={book.author}
                persona={book.persona || undefined}
              />
            </div>

          </div>
        </div>

        {/* Right Column: Contextual RAG Chat */}
        <div className="lg:col-span-7">
          <BookChat
            bookId={book.id}
            bookTitle={book.title}
            author={book.author}
            persona={book.persona || undefined}
          />
        </div>

      </div>

    </main>
  );
}
