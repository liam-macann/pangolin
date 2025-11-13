CREATE TYPE "public"."color" AS ENUM('blue', 'green', 'red', 'lavender');--> statement-breakpoint
ALTER TABLE "config" ADD COLUMN "color_scheme" "color" DEFAULT 'blue' NOT NULL;