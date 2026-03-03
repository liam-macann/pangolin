ALTER TABLE "config" ADD COLUMN "addressId" uuid;--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "config_addressId_address_id_fkey" FOREIGN KEY ("addressId") REFERENCES "address"("id");