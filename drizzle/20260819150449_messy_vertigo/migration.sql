DROP VIEW "document_with_sum";--> statement-breakpoint
DROP VIEW "items_with_tax";--> statement-breakpoint
ALTER TABLE "client_data" ALTER COLUMN "name" SET DATA TYPE text USING "name"::text;--> statement-breakpoint
ALTER TABLE "client_data" ALTER COLUMN "organization" SET DATA TYPE text USING "organization"::text;--> statement-breakpoint
ALTER TABLE "client_data" ALTER COLUMN "email" SET DATA TYPE text USING "email"::text;--> statement-breakpoint
ALTER TABLE "tax" ALTER COLUMN "name" SET DATA TYPE text USING "name"::text;--> statement-breakpoint
ALTER TABLE "document" ALTER COLUMN "title" SET DATA TYPE text USING "title"::text;--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "partition" SET DATA TYPE text USING "partition"::text;--> statement-breakpoint
ALTER TABLE "sequencer" ALTER COLUMN "partition" SET DATA TYPE text USING "partition"::text;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "chk_dependent_locality_length" CHECK (char_length("dependent_locality") <= 255);--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "chk_city_length" CHECK (char_length("city") <= 255);--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "chk_administrative_area_length" CHECK (char_length("administrative_area") <= 255);--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "chk_postal_code_length" CHECK (char_length("postal_code") <= 20);--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "chk_sorting_code_length" CHECK (char_length("sorting_code") <= 20);--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "chk_country_length" CHECK (char_length("country") <= 2);--> statement-breakpoint
ALTER TABLE "client_data" ADD CONSTRAINT "chk_client_name_length" CHECK (char_length("name") <= 255);--> statement-breakpoint
ALTER TABLE "client_data" ADD CONSTRAINT "chk_client_organization_length" CHECK (char_length("organization") <= 255);--> statement-breakpoint
ALTER TABLE "client_data" ADD CONSTRAINT "chk_client_email_length" CHECK (char_length("email") <= 255);--> statement-breakpoint
ALTER TABLE "client_data" ADD CONSTRAINT "chk_client_notes_length" CHECK (char_length("notes") <= 1000);--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "chk_trading_name_length" CHECK (char_length("trading_name") <= 255);--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "chk_language_length" CHECK (char_length("language") <= 3);--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "chk_region_length" CHECK (char_length("region") <= 20);--> statement-breakpoint
ALTER TABLE "tax" ADD CONSTRAINT "chk_tax_name_length" CHECK (char_length("name") <= 10);--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "chk_document_title_length" CHECK (char_length("title") <= 100);--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "chk_document_description_length" CHECK (char_length("description") <= 1000);--> statement-breakpoint
ALTER TABLE "invoice_status" ADD CONSTRAINT "chk_invoice_status_notes_length" CHECK (char_length("notes") <= 1000);--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "chk_invoice_partition_length" CHECK (char_length("partition") <= 50);--> statement-breakpoint
ALTER TABLE "sequencer" ADD CONSTRAINT "chk_sequencer_partition_length" CHECK (char_length("partition") <= 50);--> statement-breakpoint
ALTER TABLE "line_item" ADD CONSTRAINT "chk_line_item_label_length" CHECK (char_length("label") <= 255);--> statement-breakpoint
ALTER TABLE "line_item" ADD CONSTRAINT "chk_line_item_note_length" CHECK (char_length("note") <= 255);--> statement-breakpoint

CREATE VIEW "items_with_tax" WITH (security_barrier = true, security_invoker = true) AS (select "line_item"."id", "line_item"."document_id", "line_item"."label", "line_item"."note", "line_item"."quantity", "line_item"."unit", "line_item"."unit_cost", "line_item"."net_amount", "line_item"."order", "line_item"."user_id", "line_item"."config_id", "config"."tax_registration", ((1 + COALESCE(sum("tax"."rate") * "config"."tax_registration"::INT, 0)) * "line_item"."net_amount")::NUMERIC(19, 4) as "gross_amount" from "line_item" left join "item_tax" on "item_tax"."item_id" = "line_item"."id" left join "tax" on "item_tax"."tax_id" = "tax"."id" left join "document" on "line_item"."document_id" = "document"."id" left join "config" on "document"."config_id" = "config"."id" group by "line_item"."id", "config"."id");--> statement-breakpoint

CREATE VIEW "document_with_sum" WITH (security_barrier = true, security_invoker = true) AS (select "document"."id", "document"."user_id", "document"."client_data_id", "document"."title", "document"."description", "document"."created_at", "document"."config_id", "config"."tax_registration", "config"."currency", coalesce(sum("items_with_tax"."net_amount"),0) as "net_total", coalesce(sum("items_with_tax"."gross_amount"),0) as "gross_total" from "document" inner join "config" on "document"."config_id" = "config"."id" left join "items_with_tax" on "items_with_tax"."document_id" = "document"."id" group by "document"."id", "config"."id");
