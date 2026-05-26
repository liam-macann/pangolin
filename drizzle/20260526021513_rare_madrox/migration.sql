ALTER TABLE "config" RENAME COLUMN "registration_number" TO "trading_number";--> statement-breakpoint
ALTER TABLE "invoice_status" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "invoice_status" RENAME COLUMN "isVoid" TO "is_void";--> statement-breakpoint
ALTER POLICY "granular-crud-authenticated-policy-select" ON "invoice_status" TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "invoice_status"."user_id"));--> statement-breakpoint
ALTER POLICY "granular-crud-authenticated-policy-insert" ON "invoice_status" TO "authenticated" WITH CHECK ((select current_setting('app.user_id')::uuid = "invoice_status"."user_id"));--> statement-breakpoint
ALTER POLICY "granular-crud-authenticated-policy-update" ON "invoice_status" TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "invoice_status"."user_id")) WITH CHECK ((select current_setting('app.user_id')::uuid = "invoice_status"."user_id"));