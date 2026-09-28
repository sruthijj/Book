import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Users Table ─────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 256 }).notNull(),
    email: varchar("email", { length: 256 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
  ]
);

// ─── Books Table ─────────────────────────────────────────────────────────────
export const books = pgTable(
  "books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 256 }).default("guest"),
    title: varchar("title", { length: 500 }).notNull(),
    slug: varchar("slug", { length: 500 }).notNull().unique(),
    author: varchar("author", { length: 500 }).notNull(),
    persona: varchar("persona", { length: 100 }),
    fileURL: text("file_url").notNull(),
    fileBlobKey: varchar("file_blob_key", { length: 500 }).notNull(),
    coverURL: text("cover_url"),
    coverBlobKey: varchar("cover_blob_key", { length: 500 }),
    fileSize: integer("file_size").notNull(),
    totalSegments: integer("total_segments").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("books_slug_idx").on(table.slug),
    index("books_user_id_idx").on(table.userId),
  ]
);

// ─── Book Segments Table ─────────────────────────────────────────────────────
export const bookSegments = pgTable(
  "book_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 256 }).default("guest"),
    bookId: uuid("book_id")
      .references(() => books.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    segmentIndex: integer("segment_index").notNull(),
    pageNumber: integer("page_number"),
    wordCount: integer("word_count").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("book_segments_book_segment_idx").on(
      table.bookId,
      table.segmentIndex
    ),
    index("book_segments_book_page_idx").on(table.bookId, table.pageNumber),
    index("book_segments_book_id_idx").on(table.bookId),
  ]
);

// ─── Voice Sessions Table ────────────────────────────────────────────────────
export const voiceSessions = pgTable(
  "voice_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 256 }).default("guest"),
    bookId: uuid("book_id")
      .references(() => books.id, { onDelete: "cascade" })
      .notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    durationSeconds: integer("duration_seconds").default(0).notNull(),
    billingPeriodStart: timestamp("billing_period_start").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("voice_sessions_user_id_idx").on(table.userId),
    index("voice_sessions_book_id_idx").on(table.bookId),
  ]
);

// ─── Relations ───────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  books: many(books),
  segments: many(bookSegments),
  sessions: many(voiceSessions),
}));

export const booksRelations = relations(books, ({ many }) => ({
  segments: many(bookSegments),
  sessions: many(voiceSessions),
}));

export const bookSegmentsRelations = relations(bookSegments, ({ one }) => ({
  book: one(books, {
    fields: [bookSegments.bookId],
    references: [books.id],
  }),
}));

export const voiceSessionsRelations = relations(voiceSessions, ({ one }) => ({
  book: one(books, {
    fields: [voiceSessions.bookId],
    references: [books.id],
  }),
}));

// Inferred Types
export type UserRecord = typeof users.$inferSelect;
export type NewUserRecord = typeof users.$inferInsert;
export type BookRecord = typeof books.$inferSelect;
export type NewBookRecord = typeof books.$inferInsert;
export type BookSegmentRecord = typeof bookSegments.$inferSelect;
export type NewBookSegmentRecord = typeof bookSegments.$inferInsert;
export type VoiceSessionRecord = typeof voiceSessions.$inferSelect;
export type NewVoiceSessionRecord = typeof voiceSessions.$inferInsert;
