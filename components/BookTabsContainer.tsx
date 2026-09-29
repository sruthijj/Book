"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare, BookOpen, Sparkles } from "lucide-react";
import BookChat from "@/components/BookChat";
import BookReader from "@/components/BookReader";

interface BookTabsContainerProps {
  bookId: string;
  bookTitle: string;
  author: string;
  persona?: string;
  initialSegments?: any[];
  defaultTab?: "chat" | "reader";
}

export default function BookTabsContainer({
  bookId,
  bookTitle,
  author,
  persona,
  initialSegments = [],
  defaultTab = "reader",
}: BookTabsContainerProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "reader">(defaultTab);

  // Sync with URL hash (e.g. #reader or #chat)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.toLowerCase();
      if (hash === "#chat") {
        setActiveTab("chat");
      } else if (hash === "#reader" || hash === "#reader-view") {
        setActiveTab("reader");
      }
    }
  }, []);

  const segmentsCount = initialSegments.length;

  return (
    <div id="reader-view" className="flex flex-col gap-4 scroll-mt-24">
      {/* ─── Modern Tab Switcher ────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-2 bg-[#FFF9ED] rounded-2xl border border-[#E9E1CC] shadow-xs">
        <div className="flex items-center gap-2">
          {/* Tab 1: Read PDF Contents */}
          <button
            type="button"
            onClick={() => setActiveTab("reader")}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
              activeTab === "reader"
                ? "bg-[#663820] text-white shadow-sm"
                : "text-[#4A4A4A] hover:text-[#1C1C1C] hover:bg-[#F5F0E1]"
            }`}
          >
            <BookOpen className="w-4 h-4 flex-shrink-0" />
            <span>Read PDF Pages</span>
            {segmentsCount > 0 && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                  activeTab === "reader"
                    ? "bg-white/20 text-white"
                    : "bg-[#E9E1CC] text-[#663820]"
                }`}
              >
                {segmentsCount} {segmentsCount === 1 ? "page" : "pages"}
              </span>
            )}
          </button>

          {/* Tab 2: AI Conversation */}
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
              activeTab === "chat"
                ? "bg-[#663820] text-white shadow-sm"
                : "text-[#4A4A4A] hover:text-[#1C1C1C] hover:bg-[#F5F0E1]"
            }`}
          >
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <span>AI Assistant</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#A89F8F] px-2">
          <Sparkles className="w-3.5 h-3.5 text-[#663820]" />
          <span>Interactive Reading</span>
        </div>
      </div>

      {/* ─── Tab Content ─────────────────────────────────────────────────── */}
      <div className="w-full">
        {activeTab === "reader" ? (
          <BookReader
            bookId={bookId}
            bookTitle={bookTitle}
            author={author}
            initialSegments={initialSegments}
            onAskAI={(snippet) => {
              setActiveTab("chat");
            }}
          />
        ) : (
          <BookChat
            bookId={bookId}
            bookTitle={bookTitle}
            author={author}
            persona={persona}
          />
        )}
      </div>
    </div>
  );
}
