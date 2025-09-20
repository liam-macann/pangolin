ALTER TABLE "invoice" RENAME COLUMN "date" TO "created_at";--> statement-breakpoint
ALTER TABLE "invoice" RENAME COLUMN "yearIndex" TO "year_index";--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "issue_year" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "user_year_yearindex" UNIQUE("user_id","issue_year","year_index");