ALTER TABLE "item_tax" DROP CONSTRAINT "item_tax_item_id_invoice_item_id_fk";
--> statement-breakpoint
ALTER TABLE "item_tax" ADD CONSTRAINT "item_tax_item_id_invoice_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."invoice_item"("id") ON DELETE cascade ON UPDATE no action;