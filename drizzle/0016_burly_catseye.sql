ALTER TABLE "invoice" DROP CONSTRAINT "user_year_yearindex";--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT "due_after_created";--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "due_at" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "due_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "issued_at" date DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_year_yearindex" ON "invoice" USING btree ("user_id",EXTRACT(YEAR FROM "issued_at"),"year_index");--> statement-breakpoint
ALTER TABLE "invoice" DROP COLUMN "issue_year";--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "due_after_issued" CHECK ("invoice"."due_at" > "invoice"."issued_at");