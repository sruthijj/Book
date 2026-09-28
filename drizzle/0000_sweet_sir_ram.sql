CREATE TABLE "book_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(256) DEFAULT 'guest',
	"book_id" uuid NOT NULL,
	"content" text NOT NULL,
	"segment_index" integer NOT NULL,
	"page_number" integer,
	"word_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(256) DEFAULT 'guest',
	"title" varchar(500) NOT NULL,
	"slug" varchar(500) NOT NULL,
	"author" varchar(500) NOT NULL,
	"persona" varchar(100),
	"file_url" text NOT NULL,
	"file_blob_key" varchar(500) NOT NULL,
	"cover_url" text,
	"cover_blob_key" varchar(500),
	"file_size" integer NOT NULL,
	"total_segments" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "books_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "voice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(256) DEFAULT 'guest',
	"book_id" uuid NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"billing_period_start" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_segments" ADD CONSTRAINT "book_segments_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "book_segments_book_segment_idx" ON "book_segments" USING btree ("book_id","segment_index");--> statement-breakpoint
CREATE INDEX "book_segments_book_page_idx" ON "book_segments" USING btree ("book_id","page_number");--> statement-breakpoint
CREATE INDEX "book_segments_book_id_idx" ON "book_segments" USING btree ("book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "books_slug_idx" ON "books" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "books_user_id_idx" ON "books" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "voice_sessions_user_id_idx" ON "voice_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "voice_sessions_book_id_idx" ON "voice_sessions" USING btree ("book_id");