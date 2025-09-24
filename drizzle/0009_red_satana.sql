CREATE TYPE "public"."unit" AS ENUM('items', 'hours');--> statement-breakpoint
CREATE TABLE "invoice_item" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"label" varchar(60) NOT NULL,
	"note" varchar(60),
	"quantity" numeric(8, 2) NOT NULL,
	"unit" "unit",
	"cost" numeric(15, 4) NOT NULL,
	"order" integer
);
--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE no action ON UPDATE no action;