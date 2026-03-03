ALTER TABLE "address" ALTER COLUMN "dependent_locality" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "address" ALTER COLUMN "city" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "address" ALTER COLUMN "administrative_area" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "address" ALTER COLUMN "postal_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "address" ALTER COLUMN "sorting_code" DROP NOT NULL;