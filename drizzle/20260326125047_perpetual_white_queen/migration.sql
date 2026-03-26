ALTER TABLE "config" ALTER COLUMN "email" SET DATA TYPE bytea USING "email"::bytea;--> statement-breakpoint
ALTER TABLE "config" ALTER COLUMN "phone" SET DATA TYPE bytea USING "phone"::bytea;