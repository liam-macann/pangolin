DROP VIEW "invoice_with_sum";--> statement-breakpoint
DROP VIEW "items_with_tax";--> statement-breakpoint

ALTER TABLE "address" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_data" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "config_tax" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tax" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_count" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "item_tax" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint


ALTER TABLE "config_tax" ADD COLUMN "user_id" uuid;--> statement-breakpoint
UPDATE "config_tax" SET "user_id" = "config"."user_id"
  FROM "config" WHERE "config"."id" = "config_tax"."config_id";--> statement-breakpoint
ALTER TABLE "config_tax" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "invoice_item" ADD COLUMN "user_id" uuid;--> statement-breakpoint
UPDATE "invoice_item" SET "user_id" = "invoice"."user_id"
  FROM "invoice" WHERE "invoice"."id" = "invoice_item"."invoice_id";--> statement-breakpoint
ALTER TABLE "invoice_item" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "item_tax" ADD COLUMN "user_id" uuid;--> statement-breakpoint
UPDATE "item_tax" SET "user_id" = "invoice_item"."user_id"
  FROM "invoice_item" WHERE "invoice_item"."id" = "item_tax"."item_id";--> statement-breakpoint
ALTER TABLE "item_tax" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint



ALTER TABLE "config_tax" ADD CONSTRAINT "config_tax_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "item_tax" ADD CONSTRAINT "item_tax_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint

CREATE VIEW "items_with_tax" WITH (security_invoker = true) AS (select "invoice_item"."id", "invoice_item"."invoice_id", "invoice_item"."label", "invoice_item"."note", "invoice_item"."quantity", "invoice_item"."unit", "invoice_item"."unit_cost", "invoice_item"."net_amount", "invoice_item"."order", "invoice_item"."user_id", "invoice_item"."config_id", "config"."tax_registration", ((1 + COALESCE(sum("tax"."rate") * "config"."tax_registration"::INT, 0)) * "invoice_item"."net_amount")::NUMERIC(15, 4) as "gross_amount" from "invoice_item" left join "item_tax" on "item_tax"."item_id" = "invoice_item"."id" left join "tax" on "item_tax"."tax_id" = "tax"."id" left join "invoice" on "invoice_item"."invoice_id" = "invoice"."id" left join "config" on "invoice"."config_id" = "config"."id" group by "invoice_item"."id", "config"."id");--> statement-breakpoint
CREATE VIEW "invoice_with_sum" WITH (security_invoker = true) AS (select "invoice"."id", "invoice"."user_id", "invoice"."client_data_id", "invoice"."title", "invoice"."description", "invoice"."status", "invoice"."notes", "invoice"."is_void", "invoice"."created_at", "invoice"."issued_at", "invoice"."issue_year", "invoice"."due_at", "invoice"."index", "invoice"."year_index", "invoice"."config_id", "config"."tax_registration", "config"."currency", sum("items_with_tax"."net_amount") as "net_total", sum("items_with_tax"."gross_amount") as "gross_total" from "invoice" inner join "config" on "invoice"."config_id" = "config"."id" left join "items_with_tax" on "items_with_tax"."invoice_id" = "invoice"."id" group by "invoice"."id", "config"."id");--> statement-breakpoint

-- address
DROP POLICY IF EXISTS "address_immutable_cols" ON "address";--> statement-breakpoint

-- client_data
DROP POLICY IF EXISTS "client_data_immutable_cols" ON "client_data";--> statement-breakpoint

-- config
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-select" ON "config";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-insert" ON "config";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-update" ON "config";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-delete" ON "config";--> statement-breakpoint
DROP POLICY IF EXISTS "config_immutable_cols" ON "config";--> statement-breakpoint

-- config_tax
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-select" ON "config_tax";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-insert" ON "config_tax";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-update" ON "config_tax";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-delete" ON "config_tax";--> statement-breakpoint
DROP POLICY IF EXISTS "config_tax_immutable_cols" ON "config_tax";--> statement-breakpoint

-- tax
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-select" ON "tax";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-insert" ON "tax";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-update" ON "tax";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-delete" ON "tax";--> statement-breakpoint
DROP POLICY IF EXISTS "tax_immutable_cols" ON "tax";--> statement-breakpoint

-- invoice_count
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-select" ON "invoice_count";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-insert" ON "invoice_count";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-update" ON "invoice_count";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-delete" ON "invoice_count";--> statement-breakpoint

-- invoice_item
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-select" ON "invoice_item";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-insert" ON "invoice_item";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-update" ON "invoice_item";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-delete" ON "invoice_item";--> statement-breakpoint
DROP POLICY IF EXISTS "invoice_item_immutable_cols" ON "invoice_item";--> statement-breakpoint

-- invoice
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-select" ON "invoice";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-insert" ON "invoice";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-update" ON "invoice";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-delete" ON "invoice";--> statement-breakpoint
DROP POLICY IF EXISTS "invoice_immutable_cols" ON "invoice";--> statement-breakpoint

-- item_tax
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-select" ON "item_tax";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-insert" ON "item_tax";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-update" ON "item_tax";--> statement-breakpoint
DROP POLICY IF EXISTS "granular-crud-authenticated-policy-delete" ON "item_tax";--> statement-breakpoint
DROP POLICY IF EXISTS "item_tax_immutable_cols" ON "item_tax";--> statement-breakpoint

CREATE POLICY "address_immutable_cols" ON "address" AS RESTRICTIVE FOR UPDATE TO public USING (true) WITH CHECK (EXISTS (
      SELECT * FROM "address" "old"
      WHERE "old"."id" = "id" AND "old"."id" IS NOT DISTINCT FROM "id" AND "old"."street_address" IS NOT DISTINCT FROM "street_address" AND "old"."dependent_locality" IS NOT DISTINCT FROM "dependent_locality" AND "old"."city" IS NOT DISTINCT FROM "city" AND "old"."administrative_area" IS NOT DISTINCT FROM "administrative_area" AND "old"."postal_code" IS NOT DISTINCT FROM "postal_code" AND "old"."sorting_code" IS NOT DISTINCT FROM "sorting_code" AND "old"."country" IS NOT DISTINCT FROM "country" AND "old"."user_id" IS NOT DISTINCT FROM "user_id"
    ));--> statement-breakpoint
CREATE POLICY "client_data_immutable_cols" ON "client_data" AS RESTRICTIVE FOR UPDATE TO public USING (true) WITH CHECK (EXISTS (
      SELECT * FROM "client_data" "old"
      WHERE "old"."id" = "id" AND "old"."valid_from" IS NOT DISTINCT FROM "valid_from" AND "old"."id" IS NOT DISTINCT FROM "id" AND "old"."user_id" IS NOT DISTINCT FROM "user_id" AND "old"."client_id" IS NOT DISTINCT FROM "client_id" AND "old"."name" IS NOT DISTINCT FROM "name" AND "old"."email" IS NOT DISTINCT FROM "email" AND "old"."notes" IS NOT DISTINCT FROM "notes" AND "old"."address_id" IS NOT DISTINCT FROM "address_id"
    ));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "config" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "config"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "config" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select current_setting('app.user_id')::uuid = "config"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "config" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "config"."user_id")) WITH CHECK ((select current_setting('app.user_id')::uuid = "config"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "config" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "config"."user_id"));--> statement-breakpoint
CREATE POLICY "config_immutable_cols" ON "config" AS RESTRICTIVE FOR UPDATE TO public USING (true) WITH CHECK (EXISTS (
      SELECT * FROM "config" "old"
      WHERE "old"."id" = "id" AND "old"."valid_from" IS NOT DISTINCT FROM "valid_from" AND "old"."id" IS NOT DISTINCT FROM "id" AND "old"."user_id" IS NOT DISTINCT FROM "user_id" AND "old"."trading_name" IS NOT DISTINCT FROM "trading_name" AND "old"."email" IS NOT DISTINCT FROM "email" AND "old"."phone" IS NOT DISTINCT FROM "phone" AND "old"."header" IS NOT DISTINCT FROM "header" AND "old"."timezone" IS NOT DISTINCT FROM "timezone" AND "old"."language" IS NOT DISTINCT FROM "language" AND "old"."region" IS NOT DISTINCT FROM "region" AND "old"."locale" IS NOT DISTINCT FROM "locale" AND "old"."currency" IS NOT DISTINCT FROM "currency" AND "old"."address_id" IS NOT DISTINCT FROM "address_id" AND "old"."tax_registration" IS NOT DISTINCT FROM "tax_registration" AND "old"."payment_details" IS NOT DISTINCT FROM "payment_details" AND "old"."registration_number" IS NOT DISTINCT FROM "registration_number" AND "old"."numbering_scheme" IS NOT DISTINCT FROM "numbering_scheme" AND "old"."color_scheme" IS NOT DISTINCT FROM "color_scheme"
    ));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "config_tax" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "config_tax"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "config_tax" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select current_setting('app.user_id')::uuid = "config_tax"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "config_tax" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "config_tax" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "config_tax_immutable_cols" ON "config_tax" AS RESTRICTIVE FOR UPDATE TO public USING (true) WITH CHECK (EXISTS (
      SELECT * FROM "config_tax" "old"
      WHERE "old"."config_id" = "config_id" AND "old"."tax_id" = "tax_id" AND "old"."order" IS NOT DISTINCT FROM "order" AND "old"."config_id" IS NOT DISTINCT FROM "config_id" AND "old"."tax_id" IS NOT DISTINCT FROM "tax_id" AND "old"."user_id" IS NOT DISTINCT FROM "user_id"
    ));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "tax" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "tax"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "tax" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select current_setting('app.user_id')::uuid = "tax"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "tax" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "tax" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "tax"."user_id"));--> statement-breakpoint
CREATE POLICY "tax_immutable_cols" ON "tax" AS RESTRICTIVE FOR UPDATE TO public USING (true) WITH CHECK (EXISTS (
      SELECT * FROM "tax" "old"
      WHERE "old"."id" = "id" AND "old"."id" IS NOT DISTINCT FROM "id" AND "old"."user_id" IS NOT DISTINCT FROM "user_id" AND "old"."name" IS NOT DISTINCT FROM "name" AND "old"."rate" IS NOT DISTINCT FROM "rate"
    ));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "invoice_count" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "invoice_count"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "invoice_count" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select current_setting('app.user_id')::uuid = "invoice_count"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "invoice_count" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "invoice_count"."user_id")) WITH CHECK ((select current_setting('app.user_id')::uuid = "invoice_count"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "invoice_count" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "invoice_item" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "invoice_item"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "invoice_item" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select current_setting('app.user_id')::uuid = "invoice_item"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "invoice_item" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "invoice_item" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "invoice_item_immutable_cols" ON "invoice_item" AS RESTRICTIVE FOR UPDATE TO public USING (true) WITH CHECK (EXISTS (
      SELECT * FROM "invoice_item" "old"
      WHERE "old"."id" = "id" AND "old"."id" IS NOT DISTINCT FROM "id" AND "old"."invoice_id" IS NOT DISTINCT FROM "invoice_id" AND "old"."label" IS NOT DISTINCT FROM "label" AND "old"."note" IS NOT DISTINCT FROM "note" AND "old"."quantity" IS NOT DISTINCT FROM "quantity" AND "old"."unit" IS NOT DISTINCT FROM "unit" AND "old"."unit_cost" IS NOT DISTINCT FROM "unit_cost" AND "old"."net_amount" IS NOT DISTINCT FROM "net_amount" AND "old"."order" IS NOT DISTINCT FROM "order" AND "old"."user_id" IS NOT DISTINCT FROM "user_id" AND "old"."config_id" IS NOT DISTINCT FROM "config_id"
    ));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "invoice" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "invoice"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "invoice" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select current_setting('app.user_id')::uuid = "invoice"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "invoice" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "invoice"."user_id")) WITH CHECK ((select current_setting('app.user_id')::uuid = "invoice"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "invoice" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "invoice_immutable_cols" ON "invoice" AS RESTRICTIVE FOR UPDATE TO public USING (true) WITH CHECK (EXISTS (
      SELECT * FROM "invoice" "old"
      WHERE "old"."id" = "id" AND "old"."id" IS NOT DISTINCT FROM "id" AND "old"."user_id" IS NOT DISTINCT FROM "user_id" AND "old"."client_data_id" IS NOT DISTINCT FROM "client_data_id" AND "old"."title" IS NOT DISTINCT FROM "title" AND "old"."description" IS NOT DISTINCT FROM "description" AND "old"."created_at" IS NOT DISTINCT FROM "created_at" AND "old"."issued_at" IS NOT DISTINCT FROM "issued_at" AND "old"."issue_year" IS NOT DISTINCT FROM "issue_year" AND "old"."due_at" IS NOT DISTINCT FROM "due_at" AND "old"."index" IS NOT DISTINCT FROM "index" AND "old"."year_index" IS NOT DISTINCT FROM "year_index" AND "old"."config_id" IS NOT DISTINCT FROM "config_id"
    ));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "item_tax" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "item_tax"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "item_tax" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select current_setting('app.user_id')::uuid = "item_tax"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "item_tax" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "item_tax" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "item_tax_immutable_cols" ON "item_tax" AS RESTRICTIVE FOR UPDATE TO public USING (true) WITH CHECK (EXISTS (
      SELECT * FROM "item_tax" "old"
      WHERE "old"."item_id" = "item_id" AND "old"."tax_id" = "tax_id" AND "old"."item_id" IS NOT DISTINCT FROM "item_id" AND "old"."tax_id" IS NOT DISTINCT FROM "tax_id" AND "old"."user_id" IS NOT DISTINCT FROM "user_id" AND "old"."config_id" IS NOT DISTINCT FROM "config_id"
    ));