ALTER TABLE "invoice_item" ADD COLUMN "currency" varchar(3) DEFAULT 'AUD' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "title" varchar(100);--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "due_at" timestamp with time zone DEFAULT NOW() + INTERVAL '2 weeks' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" DROP COLUMN "amount";--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "due_after_created" CHECK ("invoice"."due_at" > "invoice"."created_at");