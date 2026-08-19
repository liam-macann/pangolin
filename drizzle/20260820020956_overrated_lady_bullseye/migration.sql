DROP VIEW "document_with_sum";--> statement-breakpoint
ALTER TABLE "config" ALTER COLUMN "currency" SET DATA TYPE text USING "currency"::text;--> statement-breakpoint
ALTER TABLE "currency" ALTER COLUMN "iso" SET DATA TYPE text USING "iso"::text;--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "chk_currency_length" CHECK (char_length("currency") = 3);--> statement-breakpoint
ALTER TABLE "currency" ADD CONSTRAINT "chk_iso_length" CHECK (char_length("iso") = 3);--> statement-breakpoint
CREATE VIEW "document_with_sum" WITH (security_barrier = true, security_invoker = true) AS (select "document"."id", "document"."user_id", "document"."client_data_id", "document"."title", "document"."description", "document"."created_at", "document"."config_id", "config"."tax_registration", "config"."currency", coalesce(sum("items_with_tax"."net_amount"),0) as "net_total", coalesce(sum("items_with_tax"."gross_amount"),0) as "gross_total" from "document" inner join "config" on "document"."config_id" = "config"."id" left join "items_with_tax" on "items_with_tax"."document_id" = "document"."id" group by "document"."id", "config"."id");
