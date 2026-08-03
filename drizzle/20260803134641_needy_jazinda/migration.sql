ALTER TABLE "client_data" RENAME CONSTRAINT "fk_client_data_ownership" TO "fk_client_data_client_ownership";--> statement-breakpoint
ALTER TABLE "document" RENAME CONSTRAINT "fk_document_client" TO "fk_document_client_data_ownership";--> statement-breakpoint
ALTER TABLE "invoice_status" RENAME CONSTRAINT "fk_invoice_status_invoice" TO "fk_invoice_status_invoice_ownership";--> statement-breakpoint
ALTER TABLE "tax" ADD CONSTRAINT "uq_tax_user" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "client_data" ADD CONSTRAINT "fk_client_data_address_ownership" FOREIGN KEY ("address_id","user_id") REFERENCES "address"("id","user_id");--> statement-breakpoint
ALTER TABLE "config_tax" ADD CONSTRAINT "fk_config_tax_config_ownership" FOREIGN KEY ("config_id","user_id") REFERENCES "config"("id","user_id");--> statement-breakpoint
ALTER TABLE "config_tax" ADD CONSTRAINT "fk_config_tax_tax_ownership" FOREIGN KEY ("tax_id","user_id") REFERENCES "tax"("id","user_id");--> statement-breakpoint
ALTER TABLE "item_tax" ADD CONSTRAINT "fk_item_tax_line_item_ownership" FOREIGN KEY ("item_id","user_id") REFERENCES "line_item"("id","user_id");--> statement-breakpoint
ALTER TABLE "item_tax" ADD CONSTRAINT "fk_item_tax_tax_ownership" FOREIGN KEY ("tax_id","user_id") REFERENCES "tax"("id","user_id");--> statement-breakpoint
ALTER TABLE "item_tax" ADD CONSTRAINT "fk_item_tax_config_ownership" FOREIGN KEY ("config_id","user_id") REFERENCES "config"("id","user_id");--> statement-breakpoint
ALTER TABLE "line_item" ADD CONSTRAINT "fk_line_item_config_ownership" FOREIGN KEY ("config_id","user_id") REFERENCES "config"("id","user_id");