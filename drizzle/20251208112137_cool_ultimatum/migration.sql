ALTER TABLE "config" ADD COLUMN "payment_details" bytea[];--> statement-breakpoint
ALTER TABLE "keychain" ALTER COLUMN "key" SET DATA TYPE bytea;