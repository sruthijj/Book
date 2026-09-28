import { ReactNode } from 'react';
import { Control, FieldPath, FieldValues } from 'react-hook-form';
import { LucideIcon } from 'lucide-react';
import z from 'zod';
import { PlanType } from "@/lib/subscription-constants";

// ============================================
// DATABASE MODELS / ENTITIES
// ============================================

export interface IBook {
    id: string;
    _id?: string;
    userId?: string;
    clerkId?: string;
    title: string;
    slug: string;
    author: string;
    persona?: string | null;
    fileURL: string;
    fileBlobKey: string;
    coverURL?: string | null;
    coverBlobKey?: string | null;
    fileSize: number;
    totalSegments: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface IBookSegment {
    id: string;
    _id?: string;
    userId?: string;
    clerkId?: string;
    bookId: string;
    content: string;
    segmentIndex: number;
    pageNumber?: number | null;
    wordCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface IVoiceSession {
    id: string;
    _id?: string;
    userId?: string;
    clerkId?: string;
    bookId: string;
    startedAt: Date;
    endedAt?: Date | null;
    durationSeconds: number;
    billingPeriodStart: Date;
    createdAt: Date;
    updatedAt: Date;
}

// ============================================
// FORM & INPUT TYPES
// ============================================

export const UploadSchema = z.object({
    pdfFile: z.any(),
    coverImage: z.any().optional(),
    title: z.string().min(1),
    authorName: z.string().min(1),
    voice: z.string().min(1),
});

export type BookUploadFormValues = z.infer<typeof UploadSchema>;

export interface CreateBook {
    clerkId?: string;
    title: string;
    slug: string;
    author: string;
    persona?: string;
    fileURL: string;
    fileBlobKey: string;
    coverURL?: string;
    coverBlobKey?: string;
    fileSize: number;
}

export interface TextSegment {
    text: string;
    segmentIndex: number;
    pageNumber?: number;
    wordCount: number;
}

export interface BookCardProps {
    title: string;
    author: string;
    coverURL: string;
    slug: string;
}

export interface Messages {
    role: string;
    content: string;
}

export interface ShadowBoxProps {
    children: ReactNode;
    className?: string;
}

export interface VoiceSelectorProps {
    disabled?: boolean;
    className?: string;
    value?: string;
    onChange: (voiceId: string) => void;
}

export interface InputFieldProps<T extends FieldValues> {
    control: Control<T>;
    name: FieldPath<T>;
    label: string;
    placeholder?: string;
    disabled?: boolean;
}

export interface FileUploadFieldProps<T extends FieldValues> {
    control: Control<T>;
    name: FieldPath<T>;
    label: string;
    acceptTypes: string[];
    disabled?: boolean;
    icon: LucideIcon;
    placeholder: string;
    hint: string;
}


export interface SessionCheckResult {
    allowed: boolean;
    currentCount: number;
    limit: number;
    plan: PlanType;
    maxDurationMinutes: number;
    error?: string;
}

export interface StartSessionResult {
    success: boolean;
    sessionId?: string;
    maxDurationMinutes?: number;
    error?: string;
    isBillingError?: boolean;
}

export interface EndSessionResult {
    success: boolean;
    error?: string;
}