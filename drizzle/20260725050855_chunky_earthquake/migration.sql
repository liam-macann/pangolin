ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "account" SET "issuer" = CASE WHEN "provider_id" = 'google' THEN 'https://accounts.google.com' ELSE 'local:oauth:' || "provider_id" END WHERE "issuer" IS NULL;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "account" RENAME COLUMN "account_id" TO "provider_account_id";