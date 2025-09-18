ALTER TABLE "customer" RENAME TO "client";--> statement-breakpoint
ALTER TABLE "invoice" RENAME COLUMN "customer_id" TO "client_id";--> statement-breakpoint
ALTER TABLE "client" DROP CONSTRAINT "customer_id_unique";--> statement-breakpoint
ALTER TABLE "client" DROP CONSTRAINT "customer_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT "customer_fk";
--> statement-breakpoint
ALTER TABLE "client" DROP CONSTRAINT "customer_user_pk";--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_user_pk" PRIMARY KEY("id","user_id");--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "client_fk" FOREIGN KEY ("client_id","user_id") REFERENCES "public"."client"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_id_unique" UNIQUE("id");