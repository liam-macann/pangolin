CREATE TABLE "address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"street_address" bytea[],
	"dependent_locality" text NOT NULL,
	"city" text NOT NULL,
	"administrative_area" text NOT NULL,
	"postal_code" text NOT NULL,
	"sorting_code" text NOT NULL,
	"country" text NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;