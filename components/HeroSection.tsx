import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus } from 'lucide-react'

const HeroSection = () => {
    return (
        <section className="wrapper mt-4">
            <div className="relative overflow-hidden rounded-[40px] bg-[#F5F0E1] px-10 py-12 lg:px-16 lg:py-14 shadow-sm border border-[#E9E1CC]/50">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative">

                    {/* Left - Content */}
                    <div className="flex flex-col gap-6 z-20 lg:col-span-4 lg:text-left text-center items-center lg:items-start">
                        <h1 className="text-5xl lg:text-6xl font-serif text-[#1C1C1C] leading-[1.1] tracking-tight">
                            Your Library
                        </h1>
                        <p className="text-lg text-[#4A4A4A] max-w-[320px] leading-relaxed">
                            Convert your books into interactive AI conversations. Listen, learn, and discuss your favorite reads.
                        </p>
                        <Link href="/new">
                            <button className="flex items-center gap-3 bg-white w-fit px-6 py-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 group border border-[#E9E1CC]/30">
                                <Plus className="w-5 h-5 text-[#1C1C1C] transition-transform group-hover:rotate-90" />
                                <span className="font-serif text-lg font-medium text-[#1C1C1C]">Add new book</span>
                            </button>
                        </Link>
                    </div>

                    {/* Center - Illustration */}
                    <div className="relative flex justify-center items-center h-[300px] lg:h-[400px] lg:col-span-4 z-10 pointer-events-none">
                        <Image
                            src="/hero-illustration.png"
                            alt="Vintage books and globe"
                            width={450}
                            height={350}
                            className="object-contain transform scale-110 lg:scale-125 select-none"
                            priority
                        />
                    </div>

                    {/* Right - Steps Card */}
                    <div className="flex justify-center lg:justify-end z-20 lg:col-span-4 w-full">
                        <div className="bg-white rounded-[24px] p-6 lg:p-8 shadow-xs border border-[#F0EBE0] w-full max-w-[320px]">
                            <div className="flex flex-col gap-6">

                                <div className="flex gap-4 items-center">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full border border-[#E9E1CC] flex items-center justify-center text-xs font-semibold text-[#4A4A4A]">
                                        1
                                    </div>
                                    <div className="flex flex-col">
                                        <h3 className="font-semibold text-base text-[#1C1C1C]">Upload PDF</h3>
                                        <p className="text-[#6B6B6B] text-xs">Add your book file</p>
                                    </div>
                                </div>

                                <div className="flex gap-4 items-center">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full border border-[#E9E1CC] flex items-center justify-center text-xs font-semibold text-[#4A4A4A]">
                                        2
                                    </div>
                                    <div className="flex flex-col">
                                        <h3 className="font-semibold text-base text-[#1C1C1C]">AI Processing</h3>
                                        <p className="text-[#6B6B6B] text-xs">We analyze the content</p>
                                    </div>
                                </div>

                                <div className="flex gap-4 items-center">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full border border-[#E9E1CC] flex items-center justify-center text-xs font-semibold text-[#4A4A4A]">
                                        3
                                    </div>
                                    <div className="flex flex-col">
                                        <h3 className="font-semibold text-base text-[#1C1C1C]">Voice Chat</h3>
                                        <p className="text-[#6B6B6B] text-xs">Discuss with AI</p>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default HeroSection
