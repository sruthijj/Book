"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Upload, FileText, Image as ImageIcon, X, Mic2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { voiceOptions, voiceCategories } from "@/lib/constants";
import LoadingOverlay from "@/components/LoadingOverlay";
import { cn } from "@/lib/utils";

// ─── Validation Schema ───────────────────────────────────────────────────────

const formSchema = z.object({
    pdfFile:     z.any().refine((file) => file instanceof File, "PDF file is required"),
    coverImage:  z.any().optional(),
    title:       z.string().min(1, "Title is required"),
    authorName:  z.string().min(1, "Author name is required"),
    voice:       z.string().min(1, "Please select a voice"),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Sub Components ──────────────────────────────────────────────────────────

interface FileDropzoneProps {
    id: string;
    accept: string;
    fileName: string | null;
    icon: React.ReactNode;
    label: string;
    hint: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemove: () => void;
}

const FileDropzone = ({ id, accept, fileName, icon, label, hint, onChange, onRemove }: FileDropzoneProps) => (
    <div className="relative">
        <input
            type="file"
            accept={accept}
            className="hidden"
            id={id}
            onChange={onChange}
        />
        {!fileName ? (
            <label htmlFor={id} className="upload-dropzone group">
                <span className="opacity-40 group-hover:opacity-100 transition-opacity">{icon}</span>
                <span className="text-lg font-bold text-[#663820]">{label}</span>
                <span className="text-sm text-[#A89F8F] font-medium">{hint}</span>
            </label>
        ) : (
            <div className="w-full h-40 border-2 border-[#663820] rounded-2xl bg-[#F5F0E1]/30 flex flex-col items-center justify-center gap-2 p-4 relative">
                {icon}
                <span className="text-lg font-bold text-[#1C1C1C] line-clamp-1 text-center">{fileName}</span>
                <button
                    type="button"
                    onClick={onRemove}
                    className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm hover:text-red-500 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        )}
    </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────

const BookUploadForm = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pdfName,   setPdfName]   = useState<string | null>(null);
    const [coverName, setCoverName] = useState<string | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title:      "",
            authorName: "",
            voice:      "rachel",
        },
    });

    // ─── Handlers ───────────────────────────────────────────────────────────

    const handleFileChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        field: "pdfFile" | "coverImage"
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        form.setValue(field, file);
        field === "pdfFile" ? setPdfName(file.name) : setCoverName(file.name);
    };

    const removeFile = (field: "pdfFile" | "coverImage") => {
        form.setValue(field, undefined);
        field === "pdfFile" ? setPdfName(null) : setCoverName(null);
    };

    const onSubmit = async (values: FormValues) => {
        try {
            setIsSubmitting(true);
            console.log("Submitting:", values);

            // TODO: Replace with real API call
            await new Promise((resolve) => setTimeout(resolve, 3000));

        } catch (error) {
            console.error("Submission failed:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="new-book-wrapper">

            {isSubmitting && <LoadingOverlay message="Synthesizing your interactive book..." />}

            {/* Page Header */}
            <div className="mb-12">
                <h1 className="text-3xl font-serif font-bold text-[#1C1C1C] mb-2">
                    Upload a PDF to generate your interactive interview
                </h1>
                <p className="text-[#6B6B6B] font-medium">5 of 10 books used (Upgrade)</p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">

                    {/* PDF Upload */}
                    <FormField
                        control={form.control}
                        name="pdfFile"
                        render={() => (
                            <FormItem>
                                <FormLabel className="form-label">Book PDF File</FormLabel>
                                <FormControl>
                                    <FileDropzone
                                        id="pdf-upload"
                                        accept=".pdf"
                                        fileName={pdfName}
                                        icon={<FileText className="w-10 h-10 text-[#663820]" />}
                                        label="Click to upload PDF"
                                        hint="PDF file (max 50MB)"
                                        onChange={(e) => handleFileChange(e, "pdfFile")}
                                        onRemove={() => removeFile("pdfFile")}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Cover Image Upload */}
                    <FormField
                        control={form.control}
                        name="coverImage"
                        render={() => (
                            <FormItem>
                                <FormLabel className="form-label">Cover Image (Optional)</FormLabel>
                                <FormControl>
                                    <FileDropzone
                                        id="cover-upload"
                                        accept="image/*"
                                        fileName={coverName}
                                        icon={<ImageIcon className="w-10 h-10 text-[#663820]" />}
                                        label="Click to upload cover image"
                                        hint="Leave empty to auto-generate from PDF"
                                        onChange={(e) => handleFileChange(e, "coverImage")}
                                        onRemove={() => removeFile("coverImage")}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Title */}
                    <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="form-label">Title</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="ex: Rich Dad Poor Dad" className="form-input" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Author */}
                    <FormField
                        control={form.control}
                        name="authorName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="form-label">Author Name</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="ex: Robert Kiyosaki" className="form-input" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Voice Selector */}
                    <div className="space-y-6">
                        <FormLabel className="form-label mb-0">Choose Assistant Voice</FormLabel>

                        {(['male', 'female'] as const).map((gender) => (
                            <div key={gender} className="space-y-4">

                                <h3 className="text-sm font-bold text-[#A89F8F] uppercase tracking-wider">
                                    {gender === 'male' ? 'Male Voices' : 'Female Voices'}
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {voiceCategories[gender].map((voiceKey) => {
                                        const voice = voiceOptions[voiceKey as keyof typeof voiceOptions];

                                        return (
                                            <FormField
                                                key={voiceKey}
                                                control={form.control}
                                                name="voice"
                                                render={({ field }) => (
                                                    <div
                                                        onClick={() => field.onChange(voiceKey)}
                                                        className={cn(
                                                            "voice-selector-option",
                                                            field.value === voiceKey && "voice-selector-option-selected"
                                                        )}
                                                    >
                                                        {/* Radio Circle */}
                                                        <div className={cn(
                                                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                                            field.value === voiceKey ? "border-[#663820]" : "border-[#E9E1CC]"
                                                        )}>
                                                            {field.value === voiceKey && (
                                                                <div className="w-2.5 h-2.5 rounded-full bg-[#663820]" />
                                                            )}
                                                        </div>

                                                        {/* Voice Info */}
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-bold text-[#1C1C1C]">{voice.name}</span>
                                                            <span className="text-xs text-[#6B6B6B] leading-snug">{voice.description}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        <FormMessage />
                    </div>

                    {/* Submit */}
                    <Button type="submit" className="form-btn shadow-brown" disabled={isSubmitting}>
                        <Mic2 className="w-6 h-6" />
                        Begin Synthesis
                    </Button>

                </form>
            </Form>
        </div>
    );
};

export default BookUploadForm;