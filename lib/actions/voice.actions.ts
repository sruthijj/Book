'use server';

import { db } from "@/db";
import { voiceSessions } from "@/db/schema";
import { eq, sql, count, and, gte } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getUserPlan } from "@/lib/subscription.server";
import { searchBookSegments } from "./book.actions";
import { getVoice } from "@/lib/utils";
import { VAPI_PUBLIC_KEY, ASSISTANT_ID } from "@/lib/constants";
import {
  StartSessionResult,
  EndSessionResult,
  SessionCheckResult,
} from "@/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks if the user is allowed to start a voice session based on their subscription plan.
 */
export async function checkVoiceSessionLimit(): Promise<SessionCheckResult> {
  try {
    const user = await getCurrentUser();
    const plan = await getUserPlan();

    // Default duration in minutes
    const maxDurationMinutes = plan === 'enterprise' ? 60 : plan === 'pro' ? 30 : 10;
    const sessionLimit = plan === 'enterprise' ? 9999 : plan === 'pro' ? 50 : 5;

    // For unauthenticated guests, allow up to 3 trial sessions
    if (!user) {
      return {
        allowed: true,
        currentCount: 0,
        limit: 3,
        plan: 'free',
        maxDurationMinutes: 10,
      };
    }

    // Calculate current billing period start (first day of current month)
    const now = new Date();
    const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [result] = await db
      .select({ sessionCount: count() })
      .from(voiceSessions)
      .where(
        and(
          eq(voiceSessions.userId, user.id),
          gte(voiceSessions.startedAt, billingPeriodStart)
        )
      );

    const currentCount = result?.sessionCount || 0;
    const allowed = currentCount < sessionLimit;

    return {
      allowed,
      currentCount,
      limit: sessionLimit,
      plan,
      maxDurationMinutes,
      error: allowed ? undefined : 'Monthly voice session limit reached for your plan.',
    };
  } catch (error) {
    console.error('Error checking voice session limit:', error);
    return {
      allowed: true, // Fail open gracefully
      currentCount: 0,
      limit: 5,
      plan: 'free',
      maxDurationMinutes: 10,
    };
  }
}

/**
 * Starts a new voice session and logs it in the database.
 */
export async function startVoiceSession(bookId: string): Promise<StartSessionResult> {
  try {
    const check = await checkVoiceSessionLimit();
    if (!check.allowed) {
      return {
        success: false,
        error: check.error || 'Voice session limit reached',
        isBillingError: true,
      };
    }

    const user = await getCurrentUser();
    const isUUID = UUID_REGEX.test(bookId);

    // If it's a sample book (e.g. ID '1'), return mock session ID without database write
    if (!isUUID) {
      return {
        success: true,
        sessionId: `sample-session-${Date.now()}`,
        maxDurationMinutes: check.maxDurationMinutes,
      };
    }

    const now = new Date();
    const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
      const [inserted] = await db
        .insert(voiceSessions)
        .values({
          userId: user?.id || 'guest',
          bookId,
          startedAt: now,
          durationSeconds: 0,
          billingPeriodStart,
        })
        .returning({ id: voiceSessions.id });

      return {
        success: true,
        sessionId: inserted.id,
        maxDurationMinutes: check.maxDurationMinutes,
      };
    } catch (dbErr) {
      console.warn('PostgreSQL unavailable for voice session, generating local session ID:', dbErr);
      return {
        success: true,
        sessionId: `local-session-${Date.now()}`,
        maxDurationMinutes: check.maxDurationMinutes,
      };
    }
  } catch (error: unknown) {
    console.error('Error starting voice session:', error);
    return {
      success: true,
      sessionId: `fallback-session-${Date.now()}`,
      maxDurationMinutes: 10,
    };
  }
}

/**
 * Ends a voice session and updates its duration.
 */
export async function endVoiceSession(
  sessionId: string,
  durationSeconds: number
): Promise<EndSessionResult> {
  try {
    if (!sessionId || sessionId.startsWith('sample-session-') || sessionId.startsWith('local-session-') || sessionId.startsWith('fallback-session-')) {
      return { success: true };
    }

    if (!UUID_REGEX.test(sessionId)) {
      return { success: true };
    }

    try {
      await db
        .update(voiceSessions)
        .set({
          endedAt: new Date(),
          durationSeconds: Math.max(0, Math.floor(durationSeconds)),
        })
        .where(eq(voiceSessions.id, sessionId));
    } catch (dbErr) {
      console.warn('PostgreSQL unavailable when ending voice session:', dbErr);
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('Error ending voice session:', error);
    return {
      success: true,
    };
  }
}

/**
 * Prepares system prompt, assistant greeting, and voice configuration for Vapi call.
 */
export async function getVoiceSessionConfig(
  bookId: string,
  bookTitle: string,
  author: string,
  persona?: string
) {
  try {
    const voice = getVoice(persona);

    // Try retrieving some key excerpts to supply as background knowledge
    let excerptsText = '';
    try {
      const searchRes = await searchBookSegments(bookId, 'summary core concepts', 3);
      if (searchRes.success && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
        excerptsText = searchRes.data.map((s, i) => `Excerpt ${i + 1}: ${s.content.slice(0, 300)}...`).join('\n\n');
      }
    } catch {
      // Ignore if no excerpts
    }

    const systemPrompt = `You are ${voice.name}, an intelligent and engaging conversational reading companion for the book "${bookTitle}" by ${author}.
Personality: ${voice.description}.

Your role:
- Speak conversationally, warmly, and naturally, as if having a coffee chat about this book.
- Keep your spoken responses concise (1 to 3 short sentences per turn) so the conversation flows like a real phone call.
- Do not use markdown, emojis, bullet points, or complex formatting since your words will be read aloud via text-to-speech.
- Ground your discussion in the ideas of "${bookTitle}" by ${author}.
${excerptsText ? `\nBook Context:\n${excerptsText}\n` : ''}`;

    const firstMessage = `Hello! I'm ${voice.name}. I'm excited to talk with you about "${bookTitle}" by ${author}. What part of the book would you like to explore together?`;

    return {
      success: true,
      vapiPublicKey: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || process.env.VAPI_PUBLIC_KEY || VAPI_PUBLIC_KEY,
      assistantId: process.env.NEXT_PUBLIC_ASSISTANT_ID || process.env.ASSISTANT_ID || ASSISTANT_ID,
      voiceId: voice.id,
      voiceName: voice.name,
      voiceDescription: voice.description,
      systemPrompt,
      firstMessage,
    };
  } catch (error: unknown) {
    console.error('Error getting voice session config:', error);
    return {
      success: false,
      vapiPublicKey: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || process.env.VAPI_PUBLIC_KEY || VAPI_PUBLIC_KEY,
      assistantId: process.env.NEXT_PUBLIC_ASSISTANT_ID || process.env.ASSISTANT_ID || ASSISTANT_ID,
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      voiceName: 'Rachel',
      voiceDescription: 'Young female, American, calm & clear',
      systemPrompt: `You are an AI reading companion for the book "${bookTitle}" by ${author}. Speak naturally, conversationally, and keep answers concise (1-2 sentences).`,
      firstMessage: `Hi! I'm ready to discuss "${bookTitle}". What would you like to talk about?`,
    };
  }
}
