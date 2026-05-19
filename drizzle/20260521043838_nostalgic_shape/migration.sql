ALTER TABLE "client_data" ADD COLUMN "organization" varchar(255);--> statement-breakpoint
ALTER TABLE "client_data" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client_data" ADD CONSTRAINT "chk_name_or_org" CHECK ("name" IS NOT NULL OR "organization" IS NOT NULL);