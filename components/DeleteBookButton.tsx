"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { deleteBook } from "@/lib/actions/book.actions";

interface DeleteBookButtonProps {
  bookId: string;
  bookTitle: string;
  variant?: "icon" | "button";
  redirectToHome?: boolean;
  className?: string;
}

export default function DeleteBookButton({
  bookId,
  bookTitle,
  variant = "button",
  redirectToHome = false,
  className = "",
}: DeleteBookButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDeleting(true);
    setError(null);

    try {
      const res = await deleteBook(bookId);
      if (!res.success) {
        setError(res.error || "Failed to delete book.");
        setIsDeleting(false);
        return;
      }

      setIsOpen(false);
      if (redirectToHome) {
        router.push("/");
      }
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
      setIsDeleting(false);
    }
  };

  const handleOpenModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setIsOpen(true);
  };

  const handleCloseModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDeleting) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={handleOpenModal}
          title={`Delete ${bookTitle}`}
          aria-label={`Delete ${bookTitle}`}
          className={`p-2 rounded-full bg-white/90 backdrop-blur-xs text-red-500 hover:text-red-700 hover:bg-red-50 transition-all shadow-sm border border-red-100 cursor-pointer ${className}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpenModal}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-red-200 text-red-600 bg-red-50/60 hover:bg-red-100/80 font-semibold text-xs sm:text-sm transition-all duration-200 cursor-pointer ${className}`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Book</span>
        </button>
      )}

      {/* Confirmation Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={handleCloseModal}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E9E1CC] space-y-5 animate-in zoom-in-95 duration-200"
          >
            {/* Modal Icon & Header */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-xl text-[#1C1C1C]">
                  Delete &quot;{bookTitle}&quot;?
                </h3>
                <p className="text-xs sm:text-sm text-[#6B6B6B] leading-relaxed">
                  Are you sure you want to remove this book? All associated AI text segments and voice sessions in Neon will be permanently deleted.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleCloseModal}
                className="px-5 py-2.5 rounded-xl border border-[#E9E1CC] text-xs sm:text-sm font-semibold text-[#4A4A4A] hover:bg-[#F5F0E1] transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
