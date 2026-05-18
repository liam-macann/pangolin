CREATE INDEX "idx_address_user_id" ON "address" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_client_data_user_id" ON "client_data" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_client_data_client_id" ON "client_data" ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_data_address_id" ON "client_data" ("address_id");--> statement-breakpoint
CREATE INDEX "idx_client_user_id" ON "client" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_config_user_id" ON "config" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_config_address_id" ON "config" ("address_id");--> statement-breakpoint
CREATE INDEX "idx_config_tax_tax_id" ON "config_tax" ("tax_id");--> statement-breakpoint
CREATE INDEX "idx_config_tax_user_id" ON "config_tax" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_item_invoice_id" ON "invoice_item" ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_item_user_id" ON "invoice_item" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_item_config_id" ON "invoice_item" ("config_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_status_user_id" ON "invoice_status" ("userId");--> statement-breakpoint
CREATE INDEX "idx_invoice_client_data_id" ON "invoice" ("client_data_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_config_id" ON "invoice" ("config_id");--> statement-breakpoint
CREATE INDEX "idx_item_tax_tax_id" ON "item_tax" ("tax_id");--> statement-breakpoint
CREATE INDEX "idx_item_tax_user_id" ON "item_tax" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_item_tax_config_id" ON "item_tax" ("config_id");