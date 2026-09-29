'use client';

import React, { useState } from 'react';
import { Mic } from 'lucide-react';
import VoiceCallModal from '@/components/VoiceCallModal';

interface VoiceCallButtonProps {
  bookId: string;
  bookTitle: string;
  author: string;
  persona?: string;
}

export default function VoiceCallButton({
  bookId,
  bookTitle,
  author,
  persona,
}: VoiceCallButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="w-full h-14 rounded-2xl bg-[#663820] hover:bg-[#4d2814] text-white font-serif font-bold text-base shadow-sm transition-all flex items-center justify-center gap-3 group mt-2 cursor-pointer active:scale-[0.99]"
      >
        <Mic className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span>Start Voice Conversation</span>
      </button>

      <VoiceCallModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        bookId={bookId}
        bookTitle={bookTitle}
        author={author}
        persona={persona}
      />
    </>
  );
}
