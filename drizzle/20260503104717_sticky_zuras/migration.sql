CREATE TABLE "invoice_status" (
	"id" uuid PRIMARY KEY,
	"userId" uuid NOT NULL,
	"status" "status" NOT NULL,
	"notes" text,
	"isVoid" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_status" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP VIEW "invoice_with_sum";--> statement-breakpoint

INSERT INTO "invoice_status" ("id", "userId", "status", "notes", "isVoid")
SELECT "id", "user_id", "status", "notes", "is_void"
FROM "invoice";--> statement-breakpoint

ALTER TABLE "invoice" ADD CONSTRAINT "uq_invoice_id_user_id" UNIQUE("id","user_id");
ALTER TABLE "invoice" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "invoice" DROP COLUMN "notes";--> statement-breakpoint
ALTER TABLE "invoice" DROP COLUMN "is_void";--> statement-breakpoint
ALTER TABLE "invoice_status" ADD CONSTRAINT "invoice_status_id_invoice_id_fkey" FOREIGN KEY ("id") REFERENCES "invoice"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invoice_status" ADD CONSTRAINT "invoice_status_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invoice_status" ADD CONSTRAINT "fk_invoice_status_invoice" FOREIGN KEY ("id","userId") REFERENCES "invoice"("id","user_id");--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "fk_invoice_status" FOREIGN KEY ("id") REFERENCES "invoice_status"("id") DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
CREATE VIEW "invoice_with_sum" WITH (security_invoker = true) AS (select "invoice"."id", "invoice"."user_id", "invoice"."client_data_id", "invoice"."title", "invoice"."description", "invoice"."created_at", "invoice"."issued_at", "invoice"."issue_year", "invoice"."due_at", "invoice"."index", "invoice"."year_index", "invoice"."config_id", "config"."tax_registration", "config"."currency", sum("items_with_tax"."net_amount") as "net_total", sum("items_with_tax"."gross_amount") as "gross_total" from "invoice" inner join "config" on "invoice"."config_id" = "config"."id" left join "items_with_tax" on "items_with_tax"."invoice_id" = "invoice"."id" group by "invoice"."id", "config"."id");--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "invoice_status" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "invoice_status"."userId"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "invoice_status" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select current_setting('app.user_id')::uuid = "invoice_status"."userId"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "invoice_status" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "invoice_status"."userId")) WITH CHECK ((select current_setting('app.user_id')::uuid = "invoice_status"."userId"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "invoice_status" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
ALTER POLICY "granular-crud-authenticated-policy-update" ON "invoice" TO "authenticated" USING (false) WITH CHECK (false);