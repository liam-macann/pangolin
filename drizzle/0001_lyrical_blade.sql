
ALTER TABLE "invoice" DROP CONSTRAINT "invoice_customer_id_customer_id_fk";
--> statement-breakpoint


ALTER TABLE "customer" DROP CONSTRAINT "customers_pkey";--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_user_pk" PRIMARY KEY("id","user_id");--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_id_unique" UNIQUE("id");
ALTER TABLE "invoice" ADD CONSTRAINT "customer_fk" FOREIGN KEY ("customer_id","user_id") REFERENCES "public"."customer"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
