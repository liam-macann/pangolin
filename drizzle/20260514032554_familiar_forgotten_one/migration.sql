ALTER TABLE "invoice_count" ADD CONSTRAINT "chk_invoice_count_year_count" CHECK ("year_count" <= "count");--> statement-breakpoint
ALTER TABLE "invoice_count" ADD CONSTRAINT "chk_positive_year_count" CHECK ("year_count" >= 0);--> statement-breakpoint
ALTER TABLE "invoice_count" ADD CONSTRAINT "chk_positive_count" CHECK ("count" >= 0);--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "chk_invoice_count_year_index" CHECK ("year_index" <= "index");--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "chk_positive_year_index" CHECK ("year_index" >= 0);--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "chk_positive_index" CHECK ("index" >= 0);