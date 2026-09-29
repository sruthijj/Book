import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface BookCardProps {
    title: string;
    author: string;
    coverURL: string;
    slug: string;
}

const BookCard = ({ title, author, coverURL, slug }: BookCardProps) => {
    return (
        <Link
            href={`/book/${slug}`}
            className="group relative flex flex-col gap-4 p-4 rounded-3xl bg-white border border-[#E9E1CC]/30 hover:shadow-xl hover:shadow-[#212a3b]/5 transition-all duration-500 hover:-translate-y-1"
        >
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#F5F0E1]">
                <Image
                    src={coverURL}
                    alt={title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    unoptimized={Boolean(coverURL && (coverURL.startsWith('data:') || coverURL.startsWith('blob:')))}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>

            <div className="flex flex-col gap-1 px-1">
                <h3 className="font-serif text-lg font-bold text-[#1C1C1C] line-clamp-1 group-hover:text-[#212a3b] transition-colors">
                    {title}
                </h3>
                <p className="text-sm text-[#6B6B6B] font-medium italic">
                    {author}
                </p>
            </div>

            <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-2 group-hover:translate-x-0">
                <div className="bg-[#212a3b] text-white p-2 rounded-full shadow-lg">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </div>
            </div>
        </Link>
    )
}

export default BookCard
