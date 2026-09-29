"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Search,
  ZoomIn,
  ZoomOut,
  Copy,
  Check,
  FileText,
  Layers,
  Sparkles,
  AlignLeft,
  Scroll,
} from "lucide-react";
import { getBookSegments } from "@/lib/actions/book.actions";

interface Segment {
  id?: string;
  content: string;
  segmentIndex: number;
  pageNumber?: number | null;
  wordCount: number;
}

interface BookReaderProps {
  bookId: string;
  bookTitle: string;
  author: string;
  initialSegments?: Segment[];
  onAskAI?: (textSnippet: string) => void;
}

export default function BookReader({
  bookId,
  bookTitle,
  author,
  initialSegments = [],
  onAskAI,
}: BookReaderProps) {
  const [segments, setSegments] = useState<Segment[]>(initialSegments);
  const [loading, setLoading] = useState(initialSegments.length === 0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg" | "xl">("base");
  const [viewMode, setViewMode] = useState<"page" | "continuous">("page");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialSegments.length > 0) {
      setSegments(initialSegments);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    getBookSegments(bookId)
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setSegments(res.data);
        }
      })
      .catch((err) => {
        console.error("Failed to load book segments:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [bookId, initialSegments]);

  // Filter segments based on search
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const query = searchQuery.toLowerCase().trim();
    return segments.filter((s) => s.content.toLowerCase().includes(query));
  }, [segments, searchQuery]);

  // Total words and estimated read time
  const totalWords = useMemo(
    () => segments.reduce((sum, s) => sum + (s.wordCount || 0), 0),
    [segments]
  );
  const estimatedReadingMinutes = Math.max(1, Math.ceil(totalWords / 200));

  const currentSegment = filteredSegments[currentPageIndex] || filteredSegments[0];

  const handleNextPage = () => {
    if (currentPageIndex < filteredSegments.length - 1) {
      setCurrentPageIndex((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  const handleCopyPage = () => {
    if (!currentSegment) return;
    navigator.clipboard.writeText(currentSegment.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Font size classes
  const fontClasses = {
    sm: "text-sm sm:text-base leading-relaxed",
    base: "text-base sm:text-lg leading-relaxed sm:leading-loose",
    lg: "text-lg sm:text-xl leading-loose",
    xl: "text-xl sm:text-2xl leading-loose",
  }[fontSize];

  return (
    <div className="bg-white rounded-3xl border border-[#E9E1CC] shadow-xs overflow-hidden flex flex-col min-h-[620px]">
      
      {/* ─── Reader Header Bar ────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 border-b border-[#E9E1CC] bg-[#FFFDF8] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#F5F0E1] text-[#663820] flex items-center justify-center border border-[#E9E1CC] flex-shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-base sm:text-lg text-[#1C1C1C] line-clamp-1">
              {bookTitle}
            </h2>
            <div className="flex items-center gap-2 text-xs text-[#6B6B6B]">
              <span>by {author}</span>
              <span>•</span>
              <span>{segments.length} Pages/Sections</span>
              <span>•</span>
              <span>~{estimatedReadingMinutes} min read</span>
            </div>
          </div>
        </div>

        {/* View Mode & Font Size Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mode Switch: Page by Page vs Continuous */}
          <div className="flex items-center bg-[#F5F0E1]/80 p-0.5 rounded-xl border border-[#E9E1CC] text-xs font-semibold">
            <button
              onClick={() => setViewMode("page")}
              title="Page-by-page view"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "page"
                  ? "bg-white text-[#663820] shadow-xs"
                  : "text-[#6B6B6B] hover:text-[#1C1C1C]"
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pages</span>
            </button>
            <button
              onClick={() => setViewMode("continuous")}
              title="Continuous scroll view"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "continuous"
                  ? "bg-white text-[#663820] shadow-xs"
                  : "text-[#6B6B6B] hover:text-[#1C1C1C]"
              }`}
            >
              <Scroll className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Scroll</span>
            </button>
          </div>

          {/* Font Size Adjusters */}
          <div className="flex items-center bg-[#F5F0E1]/80 rounded-xl border border-[#E9E1CC] p-0.5">
            <button
              onClick={() => {
                if (fontSize === "xl") setFontSize("lg");
                else if (fontSize === "lg") setFontSize("base");
                else if (fontSize === "base") setFontSize("sm");
              }}
              disabled={fontSize === "sm"}
              title="Decrease font size"
              className="p-1.5 text-[#6B6B6B] hover:text-[#1C1C1C] disabled:opacity-30 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-semibold text-[#4A4A4A] px-1 uppercase">
              {fontSize}
            </span>
            <button
              onClick={() => {
                if (fontSize === "sm") setFontSize("base");
                else if (fontSize === "base") setFontSize("lg");
                else if (fontSize === "lg") setFontSize("xl");
              }}
              disabled={fontSize === "xl"}
              title="Increase font size"
              className="p-1.5 text-[#6B6B6B] hover:text-[#1C1C1C] disabled:opacity-30 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Search & Jump to Page Toolbar ─────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-2.5 bg-[#FFF9ED]/60 border-b border-[#E9E1CC]/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPageIndex(0);
            }}
            placeholder="Search within book content..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-white border border-[#E9E1CC] text-xs text-[#1C1C1C] focus:outline-none focus:ring-1 focus:ring-[#663820]"
          />
          <Search className="w-3.5 h-3.5 text-[#A89F8F] absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>

        {viewMode === "page" && filteredSegments.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[#6B6B6B] font-medium">Page:</span>
            <select
              value={currentPageIndex}
              onChange={(e) => setCurrentPageIndex(Number(e.target.value))}
              className="h-8 px-2 rounded-lg bg-white border border-[#E9E1CC] text-xs font-semibold text-[#1C1C1C] focus:outline-none"
            >
              {filteredSegments.map((s, idx) => (
                <option key={s.id || idx} value={idx}>
                  {s.pageNumber ? `Page ${s.pageNumber}` : `Section ${idx + 1}`}
                </option>
              ))}
            </select>
            <span className="text-[#A89F8F]">of {filteredSegments.length}</span>
          </div>
        )}
      </div>

      {/* ─── Reading Area ─────────────────────────────────────────────────── */}
      <div className="flex-1 p-5 sm:p-8 md:p-10 overflow-y-auto max-h-[600px] bg-[#FFFDF8]">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-center text-[#6B6B6B]">
            <Layers className="w-8 h-8 text-[#663820] animate-pulse" />
            <p className="text-sm font-medium">Loading book content from Neon database...</p>
          </div>
        ) : filteredSegments.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-center text-[#6B6B6B]">
            <FileText className="w-10 h-10 text-[#A89F8F]" />
            <h3 className="font-serif font-bold text-lg text-[#1C1C1C]">No Content Found</h3>
            <p className="text-xs sm:text-sm max-w-sm">
              {searchQuery
                ? `No matching pages found for "${searchQuery}". Try a different keyword.`
                : "No text segments have been indexed for this book yet."}
            </p>
          </div>
        ) : viewMode === "page" ? (
          /* Single Page View */
          <article className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between border-b border-[#E9E1CC]/60 pb-3 text-xs text-[#A89F8F] font-semibold">
              <span className="uppercase tracking-wider">
                {currentSegment.pageNumber
                  ? `Page ${currentSegment.pageNumber}`
                  : `Section ${currentPageIndex + 1}`}
              </span>
              <div className="flex items-center gap-3">
                <span>{currentSegment.wordCount || 0} words</span>
                <button
                  onClick={handleCopyPage}
                  title="Copy page text"
                  className="flex items-center gap-1 hover:text-[#663820] transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
                {onAskAI && (
                  <button
                    onClick={() => onAskAI(currentSegment.content.slice(0, 300))}
                    title="Ask AI questions about this page"
                    className="flex items-center gap-1 text-[#663820] hover:underline cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask AI</span>
                  </button>
                )}
              </div>
            </div>

            <div className={`font-serif text-[#2C2416] whitespace-pre-wrap ${fontClasses}`}>
              {currentSegment.content}
            </div>
          </article>
        ) : (
          /* Continuous Scroll View */
          <div className="max-w-2xl mx-auto space-y-10 divide-y divide-[#E9E1CC]/60">
            {filteredSegments.map((segment, idx) => (
              <article key={segment.id || idx} className="pt-8 first:pt-0 space-y-3">
                <div className="flex items-center justify-between text-xs text-[#A89F8F] font-semibold">
                  <span className="uppercase tracking-wider">
                    {segment.pageNumber ? `Page ${segment.pageNumber}` : `Section ${idx + 1}`}
                  </span>
                  <span>{segment.wordCount} words</span>
                </div>
                <div className={`font-serif text-[#2C2416] whitespace-pre-wrap ${fontClasses}`}>
                  {segment.content}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* ─── Page Navigation Footer (Only in Page Mode) ─────────────────────── */}
      {viewMode === "page" && filteredSegments.length > 1 && (
        <div className="p-3 sm:p-4 bg-[#FFFDF8] border-t border-[#E9E1CC] flex items-center justify-between">
          <button
            onClick={handlePrevPage}
            disabled={currentPageIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E9E1CC] text-xs sm:text-sm font-semibold text-[#1C1C1C] hover:bg-[#F5F0E1] disabled:opacity-40 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <span className="text-xs font-semibold text-[#6B6B6B]">
            {currentPageIndex + 1} of {filteredSegments.length}
          </span>

          <button
            onClick={handleNextPage}
            disabled={currentPageIndex >= filteredSegments.length - 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#663820] hover:bg-[#4d2814] text-white text-xs sm:text-sm font-semibold disabled:opacity-40 transition-all cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  );
}
