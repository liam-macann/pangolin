ALTER TABLE "invoice_item" DROP CONSTRAINT "invoice_item_invoice_id_invoice_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;