ALTER TABLE "invoice" ALTER COLUMN "title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "description" text;