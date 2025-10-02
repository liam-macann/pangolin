CREATE TABLE "item_tax" (
	"item_id" uuid NOT NULL,
	"tax_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(10) NOT NULL,
	"rate" numeric(5, 3) NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_tax" ADD CONSTRAINT "item_tax_item_id_invoice_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."invoice_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tax" ADD CONSTRAINT "item_tax_tax_id_tax_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."tax"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax" ADD CONSTRAINT "tax_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;