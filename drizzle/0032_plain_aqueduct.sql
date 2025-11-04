ALTER TABLE "config" ALTER COLUMN "numbering_scheme" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."numbering_scheme";--> statement-breakpoint
CREATE TYPE "public"."numbering_scheme" AS ENUM('sequential', 'annual');--> statement-breakpoint
ALTER TABLE "config" ALTER COLUMN "numbering_scheme" SET DATA TYPE "public"."numbering_scheme" USING "numbering_scheme"::"public"."numbering_scheme";