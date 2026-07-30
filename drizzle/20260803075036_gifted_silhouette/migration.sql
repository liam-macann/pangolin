CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"client_data_id" uuid NOT NULL,
	"title" varchar(100),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"config_id" uuid NOT NULL,
	CONSTRAINT "uq_document_id_config" UNIQUE("id","config_id"),
	CONSTRAINT "uq_document_id_user_id" UNIQUE("id","user_id")
);
--> statement-breakpoint
ALTER TABLE "document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Backfill: split each existing invoice row into a document (identity/content) row.
-- The document reuses the invoice id, so invoice.id can act as both PK and FK
-- into document(id) (see invoice_id_document_id_fkey below), and the
-- line_item existing invoice_id keeps pointing at a valid row
INSERT INTO "document" ("id", "user_id", "client_data_id", "title", "description", "created_at", "config_id")
SELECT "id", "user_id", "client_data_id", "title", "description", "created_at", "config_id"
FROM "invoice";--> statement-breakpoint

DROP VIEW "invoice_with_sum";--> statement-breakpoint
DROP VIEW "items_with_tax";--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT "invoice_client_data_id_client_data_id_fk";--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT "invoice_config_id_config_id_fk";--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT "fk_invoice_client";--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT "fk_invoice_config_ownership";--> statement-breakpoint
ALTER TABLE "line_item" RENAME COLUMN "invoice_id" TO "document_id";--> statement-breakpoint
ALTER TABLE "line_item" RENAME CONSTRAINT "invoice_item_invoice_id_invoice_id_fk" TO "line_item_document_id_document_id_fkey";--> statement-breakpoint
ALTER TABLE "line_item" RENAME CONSTRAINT "fk_invoice_item_invoice_config" TO "fk_line_item_document_config";--> statement-breakpoint

-- Re-point line_item's FKs at document before invoice's uq_invoice_id_config is dropped below:
-- fk_line_item_document_config still targets invoice(id, config_id) at this point and would
-- block that drop otherwise.
ALTER TABLE "line_item" DROP CONSTRAINT "line_item_document_id_document_id_fkey", ADD CONSTRAINT "line_item_document_id_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "line_item" DROP CONSTRAINT "fk_line_item_document_config", ADD CONSTRAINT "fk_line_item_document_config" FOREIGN KEY ("document_id","config_id") REFERENCES "document"("id","config_id");--> statement-breakpoint

ALTER TABLE "invoice" DROP CONSTRAINT "uq_invoice_id_config";--> statement-breakpoint
ALTER INDEX "idx_invoice_item_invoice_id" RENAME TO "idx_line_item_document_id";--> statement-breakpoint
ALTER INDEX "idx_invoice_item_user_id" RENAME TO "idx_line_item_user_id";--> statement-breakpoint
ALTER INDEX "idx_invoice_item_config_id" RENAME TO "idx_line_item_config_id";--> statement-breakpoint
DROP INDEX "idx_invoice_client_data_id";--> statement-breakpoint
DROP INDEX "idx_invoice_config_id";--> statement-breakpoint
ALTER TABLE "line_item" RENAME CONSTRAINT "uq_invoice_item_id_config" TO "uq_line_item_id_config";--> statement-breakpoint

ALTER TABLE "invoice" DROP COLUMN "client_data_id";--> statement-breakpoint
ALTER TABLE "invoice" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "invoice" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "invoice" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "invoice" DROP COLUMN "config_id";--> statement-breakpoint

CREATE INDEX "idx_document_client_data_id" ON "document" ("client_data_id");--> statement-breakpoint
CREATE INDEX "idx_document_config_id" ON "document" ("config_id");--> statement-breakpoint
ALTER TABLE "line_item" ADD CONSTRAINT "uq_line_item_id_user_id" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_client_data_id_client_data_id_fkey" FOREIGN KEY ("client_data_id") REFERENCES "client_data"("id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_config_id_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "config"("id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "fk_document_client" FOREIGN KEY ("client_data_id","user_id") REFERENCES "client_data"("id","user_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "fk_document_config_ownership" FOREIGN KEY ("config_id","user_id") REFERENCES "config"("id","user_id");--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_id_document_id_fkey" FOREIGN KEY ("id") REFERENCES "document"("id");--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "fk_invoice_document_ownership" FOREIGN KEY ("id","user_id") REFERENCES "document"("id","user_id");--> statement-breakpoint
ALTER TABLE "line_item" ADD CONSTRAINT "fk_line_item_document_ownership" FOREIGN KEY ("document_id","user_id") REFERENCES "document"("id","user_id");--> statement-breakpoint

CREATE VIEW "items_with_tax" WITH (security_barrier = true, security_invoker = true) AS (select "line_item"."id", "line_item"."document_id", "line_item"."label", "line_item"."note", "line_item"."quantity", "line_item"."unit", "line_item"."unit_cost", "line_item"."net_amount", "line_item"."order", "line_item"."user_id", "line_item"."config_id", "config"."tax_registration", ((1 + COALESCE(sum("tax"."rate") * "config"."tax_registration"::INT, 0)) * "line_item"."net_amount")::NUMERIC(19, 4) as "gross_amount" from "line_item" left join "item_tax" on "item_tax"."item_id" = "line_item"."id" left join "tax" on "item_tax"."tax_id" = "tax"."id" left join "document" on "line_item"."document_id" = "document"."id" left join "config" on "document"."config_id" = "config"."id" group by "line_item"."id", "config"."id");--> statement-breakpoint
CREATE VIEW "document_with_sum" WITH (security_barrier = true, security_invoker = true) AS (select "document"."id", "document"."user_id", "document"."client_data_id", "document"."title", "document"."description", "document"."created_at", "document"."config_id", "config"."tax_registration", "config"."currency", coalesce(sum("items_with_tax"."net_amount"),0) as "net_total", coalesce(sum("items_with_tax"."gross_amount"),0) as "gross_total" from "document" inner join "config" on "document"."config_id" = "config"."id" left join "items_with_tax" on "items_with_tax"."document_id" = "document"."id" group by "document"."id", "config"."id");--> statement-breakpoint

CREATE POLICY "granular-crud-authenticated-policy-select" ON "document" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "document"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "document" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select current_setting('app.user_id')::uuid = "document"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "document" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "document" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);
