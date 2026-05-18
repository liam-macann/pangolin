ALTER TABLE "invoice" RENAME CONSTRAINT "chk_invoice_count_year_index" TO "chk_invoice_year_index";--> statement-breakpoint
ALTER TABLE "keychain" RENAME CONSTRAINT "keychain_id_user_id_fk" TO "keychain_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "uq_config_user" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "fk_invoice_config_ownership" FOREIGN KEY ("config_id","user_id") REFERENCES "config"("id","user_id");--> statement-breakpoint
ALTER TABLE "keychain" DROP CONSTRAINT "keychain_id_user_id_fkey", ADD CONSTRAINT "keychain_id_user_id_fkey" FOREIGN KEY ("id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT "chk_due_after_issued", ADD CONSTRAINT "chk_due_after_issued" CHECK ("due_at" >= "issued_at");--> statement-breakpoint
ALTER POLICY "granular-crud-authenticated-policy-update" ON "client_data" TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
ALTER POLICY "granular-crud-authenticated-policy-update" ON "config" TO "authenticated" USING (false) WITH CHECK (false);