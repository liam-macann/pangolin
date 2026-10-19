ALTER TABLE "invoice_status" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
-- The void date of existing voided invoices is unknown, so the epoch marks it
UPDATE "invoice_status" SET "voided_at" = 'epoch'::timestamptz WHERE "is_void";--> statement-breakpoint
ALTER TABLE "invoice_status" DROP COLUMN "is_void";
