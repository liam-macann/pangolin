ALTER TABLE "config" DROP COLUMN IF EXISTS "language";
ALTER TABLE "config" DROP COLUMN IF EXISTS "region";
ALTER TABLE "config" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "config" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "config" DROP COLUMN IF EXISTS "locale";--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "chk_language_lowercase" CHECK ("language" = lower("language"));--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "chk_region_uppercase" CHECK ("region" = upper("region"));--> statement-breakpoint
ALTER TABLE "config" ADD COLUMN "locale" text GENERATED ALWAYS AS ("config"."language" || COALESCE('-' || "config"."region", '')) STORED;