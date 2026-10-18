CREATE DOMAIN "unicode_text" AS text COLLATE "unicode";--> statement-breakpoint
ALTER TABLE "client_data" DROP COLUMN "display_name";--> statement-breakpoint
ALTER TABLE "client_data" ALTER COLUMN "name" SET DATA TYPE unicode_text USING "name"::unicode_text;--> statement-breakpoint
ALTER TABLE "client_data" ALTER COLUMN "organization" SET DATA TYPE unicode_text USING "organization"::unicode_text;--> statement-breakpoint
ALTER TABLE "client_data" ADD COLUMN "display_name" unicode_text GENERATED ALWAYS AS (coalesce("name", "organization")) STORED NOT NULL;
