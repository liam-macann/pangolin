ALTER TABLE "item_tax" ADD CONSTRAINT "item_tax_pkey" PRIMARY KEY("item_id","tax_id");--> statement-breakpoint
ALTER TABLE "tax" ADD CONSTRAINT "user_name_rate" UNIQUE("user_id","name","rate");