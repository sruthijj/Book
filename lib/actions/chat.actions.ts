'use server';

import { searchBookSegments } from './book.actions';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    id?: string;
    content: string;
    pageNumber?: number | null;
    segmentIndex?: number;
  }>;
  createdAt: Date;
}

export interface AskAssistantParams {
  bookId: string;
  bookTitle: string;
  author: string;
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AskAssistantResponse {
  success: boolean;
  answer?: string;
  sources?: Array<{
    id?: string;
    content: string;
    pageNumber?: number | null;
    segmentIndex?: number;
  }>;
  error?: string;
}

export async function askBookAssistant({
  bookId,
  bookTitle,
  author,
  question,
  history = [],
}: AskAssistantParams): Promise<AskAssistantResponse> {
  try {
    if (!question || !question.trim()) {
      return { success: false, error: 'Question cannot be empty' };
    }

    // 1. Retrieve relevant passages from the book (RAG)
    let sources: any[] = [];
    try {
      const searchRes = await searchBookSegments(bookId, question, 4);
      if (searchRes.success && Array.isArray(searchRes.data)) {
        sources = searchRes.data;
      }
    } catch (err) {
      console.warn('Could not search segments (database may be uninitialized):', err);
    }

    const contextText = sources.length > 0
      ? sources.map((s, idx) => `[Excerpt ${idx + 1}${s.pageNumber ? ` - Page ${s.pageNumber}` : ''}]:\n${s.content}`).join('\n\n')
      : 'No specific excerpts found in database.';

    // 2. Check for AI Providers
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    const systemPrompt = `You are an insightful and engaging AI reading companion for the book "${bookTitle}" by ${author}.
Your goal is to help the reader understand, analyze, and discuss the ideas in this book.

Book Excerpts Retrieved from Database:
"""
${contextText}
"""

Guidelines:
1. Ground your answers primarily in the book excerpts provided above whenever available.
2. If the excerpts don't contain the full answer, draw upon your general literary knowledge of "${bookTitle}" by ${author} to provide a thoughtful, helpful response.
3. Be conversational, encouraging, and clear.
4. Keep answers concise (2-3 paragraphs maximum) so it feels like a natural conversation.`;

    // ─── Option A: Google Gemini API ──────────────────────────────────────────
    if (geminiKey) {
      try {
        const contents = [
          {
            role: 'user',
            parts: [{ text: systemPrompt }],
          },
          {
            role: 'model',
            parts: [{ text: `Understood! I am ready to discuss "${bookTitle}" with you.` }],
          },
          ...history.slice(-6).map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
          })),
          {
            role: 'user',
            parts: [{ text: question }],
          },
        ];

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (answer) {
            return {
              success: true,
              answer,
              sources: sources.length > 0 ? sources : undefined,
            };
          }
        }
      } catch (geminiErr) {
        console.error('Gemini API error, falling back:', geminiErr);
      }
    }

    // ─── Option B: OpenAI API ─────────────────────────────────────────────────
    if (openaiKey) {
      try {
        const messages = [
          { role: 'system', content: systemPrompt },
          ...history.slice(-6).map((msg) => ({ role: msg.role, content: msg.content })),
          { role: 'user', content: question },
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.7,
            max_tokens: 600,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const answer = data.choices?.[0]?.message?.content;
          if (answer) {
            return {
              success: true,
              answer,
              sources: sources.length > 0 ? sources : undefined,
            };
          }
        }
      } catch (openaiErr) {
        console.error('OpenAI API error, falling back:', openaiErr);
      }
    }

    // ─── Option C: Graceful Fallback Mode (No API Key configured yet) ────────
    if (sources.length > 0) {
      const excerptsSummary = sources
        .map((s, idx) => `• [Excerpt ${idx + 1}${s.pageNumber ? ` - Page ${s.pageNumber}` : ''}]: "${s.content.slice(0, 280)}..."`)
        .join('\n\n');

      return {
        success: true,
        answer: `I searched the indexed segments for "${bookTitle}" and retrieved ${sources.length} matching passages related to your question:\n\n${excerptsSummary}\n\n💡 Tip: Add \`GEMINI_API_KEY\` or \`OPENAI_API_KEY\` to your \`.env.local\` file to enable full conversational AI synthesis!`,
        sources,
      };
    }

    // Fallback for sample/unindexed books
    return {
      success: true,
      answer: `I'm ready to discuss "${bookTitle}" by ${author}! To enable full AI answers grounded in this book, you can add your \`GEMINI_API_KEY\` or \`OPENAI_API_KEY\` in \`.env.local\`. When you upload your own book PDF, all text segments will be stored in PostgreSQL and used as direct context here.`,
      sources: undefined,
    };
  } catch (error: any) {
    console.error('Error asking assistant:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate answer',
    };
  }
}
