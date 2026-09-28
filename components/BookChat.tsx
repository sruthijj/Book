'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, BookOpen, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { askBookAssistant, ChatMessage } from '@/lib/actions/chat.actions';

interface BookChatProps {
  bookId: string;
  bookTitle: string;
  author: string;
  persona?: string;
}

const suggestedPrompts = [
  "What are the core takeaways of this book?",
  "Can you summarize the main arguments?",
  "What is the most practical advice given?",
  "Explain the key concept in simple terms.",
];

export default function BookChat({ bookId, bookTitle, author }: BookChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm your reading companion for "${bookTitle}" by ${author}. Ask me anything about the concepts, chapters, or specific ideas in this book!`,
      createdAt: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (questionText?: string) => {
    const textToSend = questionText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!questionText) setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await askBookAssistant({
        bookId,
        bookTitle,
        author,
        question: textToSend.trim(),
        history,
      });

      if (res.success && res.answer) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: res.answer,
          sources: res.sources,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errorMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: res.error || "I'm sorry, I couldn't generate an answer right now. Please try again.",
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch {
      const errorMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: 'An unexpected connection error occurred. Please try again.',
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSources = (id: string) => {
    setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col h-[650px] md:h-[720px] bg-white rounded-3xl border border-[#E9E1CC] shadow-xs overflow-hidden">
      
      {/* Chat Header */}
      <div className="px-6 py-4 bg-[#F5F0E1]/50 border-b border-[#E9E1CC] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#663820] text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-base text-[#1C1C1C] flex items-center gap-2">
              Book Context Assistant
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                RAG Active
              </span>
            </h2>
            <p className="text-xs text-[#6B6B6B]">Grounded in verified book excerpts</p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.map((message) => {
          const isUser = message.role === 'user';
          const hasSources = message.sources && message.sources.length > 0;
          const isSourcesExpanded = expandedSources[message.id];

          return (
            <div
              key={message.id}
              className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-[#F5F0E1] border border-[#E9E1CC] text-[#663820] flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 sm:p-5 ${
                  isUser
                    ? 'bg-[#663820] text-white rounded-tr-xs'
                    : 'bg-[#FFF9ED]/60 border border-[#E9E1CC] text-[#1C1C1C] rounded-tl-xs shadow-xs'
                }`}
              >
                <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans">
                  {message.content}
                </div>

                {/* Retrieved Source Passages (RAG Citations) */}
                {hasSources && (
                  <div className="mt-4 pt-3 border-t border-[#E9E1CC]/80">
                    <button
                      onClick={() => toggleSources(message.id)}
                      className="text-xs font-semibold text-[#663820] flex items-center gap-1.5 hover:underline transition-all"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{message.sources!.length} Excerpts Retrieved from Database</span>
                      {isSourcesExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {isSourcesExpanded && (
                      <div className="mt-2.5 space-y-2">
                        {message.sources!.map((source, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-white rounded-xl border border-[#E9E1CC] text-xs text-[#4A4A4A] leading-relaxed"
                          >
                            <span className="font-semibold text-[#1C1C1C] block mb-1">
                              Passage {idx + 1}
                              {source.pageNumber ? ` • Page ${source.pageNumber}` : ''}
                            </span>
                            &ldquo;{source.content}&rdquo;
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-full bg-[#1C1C1C] text-white flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 items-center text-[#6B6B6B] text-sm animate-pulse pl-1">
            <div className="w-8 h-8 rounded-full bg-[#F5F0E1] border border-[#E9E1CC] text-[#663820] flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 p-3 bg-[#FFF9ED]/60 rounded-xl border border-[#E9E1CC]">
              <Loader2 className="w-4 h-4 animate-spin text-[#663820]" />
              <span>Analyzing book context and synthesizing answer...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 bg-[#FFF9ED]/30 border-t border-[#E9E1CC]/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-semibold text-[#A89F8F] uppercase tracking-wider flex-shrink-0">
            Suggested:
          </span>
          {suggestedPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="text-xs px-3 py-1.5 rounded-full bg-white border border-[#E9E1CC] text-[#4A4A4A] hover:bg-[#F5F0E1] hover:text-[#1C1C1C] transition-colors whitespace-nowrap flex-shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <div className="p-3 sm:p-4 bg-white border-t border-[#E9E1CC]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 sm:gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder={`Ask a question about ${bookTitle}...`}
            className="flex-1 h-12 px-4 rounded-xl border border-[#E9E1CC] bg-[#FFF9ED]/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#663820]/20 focus:border-[#663820] transition-all"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-12 w-12 rounded-xl bg-[#663820] hover:bg-[#4d2814] text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-xs"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>

    </div>
  );
}
