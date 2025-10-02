ALTER TABLE "config" ADD COLUMN "currency" varchar(3) DEFAULT 'AUD' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_item" DROP COLUMN "currency";