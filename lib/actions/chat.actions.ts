'use server';

import { searchBookSegments } from './book.actions';
import { getVoice } from '@/lib/utils';

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
  persona?: string;
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
  persona,
  question,
  history = [],
}: AskAssistantParams): Promise<AskAssistantResponse> {
  try {
    if (!question || !question.trim()) {
      return { success: false, error: 'Question cannot be empty' };
    }

    // 1. Retrieve relevant passages from the book (RAG)
    let sources: Array<{
      id?: string;
      content: string;
      pageNumber?: number | null;
      segmentIndex?: number;
    }> = [];

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

    // 2. Persona context
    const voice = persona ? getVoice(persona) : null;
    const personaInstruction = voice
      ? `Persona: You embody "${voice.name}" (${voice.description}). Adopt this speaking style, tone, and mannerisms naturally throughout the discussion.`
      : '';

    const systemPrompt = `You are a precise, direct AI assistant answering questions about the book "${bookTitle}" by ${author}.
${personaInstruction ? `\n${personaInstruction}\n` : ''}
Book Excerpts Retrieved from Database:
"""
${contextText}
"""

STRICT INSTRUCTIONS:
1. Answer ONLY what the user explicitly asks. Do not provide unprompted summaries, unrelated commentary, or unsolicited suggestions.
2. Go straight to the answer without any introductory pleasantries or filler (never say "Certainly!", "Sure thing!", or "As an AI companion...").
3. Ground your response in the provided book excerpts whenever available.
4. Keep the answer strictly focused, accurate, and concise.
5. If the book does not contain the answer, state that directly in one clear sentence.`;

    // 3. Check for AI Providers
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // ─── Option A: Google Gemini API ──────────────────────────────────────────
    if (geminiKey) {
      try {
        // Prepare alternating history for Gemini
        const formattedHistory: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];
        let lastRole: string | null = null;
        for (const msg of history.slice(-6)) {
          const role = msg.role === 'user' ? 'user' : 'model';
          if (role !== lastRole && msg.content.trim()) {
            formattedHistory.push({ role, parts: [{ text: msg.content }] });
            lastRole = role;
          }
        }

        // If history ends with a user message, remove it so the final question maintains user turn
        if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === 'user') {
          formattedHistory.pop();
        }

        const contents = [
          ...formattedHistory,
          {
            role: 'user',
            parts: [{ text: question }],
          },
        ];

        let response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: {
                parts: [{ text: systemPrompt }],
              },
              contents,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 800,
              },
            }),
          }
        );

        if (!response.ok) {
          // Fallback to flash-lite if flash is busy or unavailable
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: {
                  parts: [{ text: systemPrompt }],
                },
                contents,
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 800,
                },
              }),
            }
          );
        }

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
        } else {
          const errText = await response.text();
          console.error(`Gemini API error (Status ${response.status}):`, errText);
        }
      } catch (geminiErr) {
        console.error('Gemini API call failed, attempting fallback:', geminiErr);
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
            temperature: 0.2,
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
        } else {
          const errText = await response.text();
          console.error(`OpenAI API error (Status ${response.status}):`, errText);
        }
      } catch (openaiErr) {
        console.error('OpenAI API call failed, falling back:', openaiErr);
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
      answer: `I'm ready to discuss "${bookTitle}" by ${author}! To enable full AI answers grounded in this book, add your \`GEMINI_API_KEY\` (Google AI Studio) or \`OPENAI_API_KEY\` in \`.env.local\`. When you upload your own book PDF, all text segments will be stored in PostgreSQL and used as direct context here.`,
      sources: undefined,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to generate answer';
    console.error('Error asking assistant:', error);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
