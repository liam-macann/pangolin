ALTER TABLE "client_data" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "client_data" ADD COLUMN "address_id" uuid;--> statement-breakpoint
ALTER TABLE "client_data" ADD CONSTRAINT "client_data_address_id_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "address"("id");