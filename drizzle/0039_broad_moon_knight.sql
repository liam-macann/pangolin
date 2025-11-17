ALTER TABLE "client" DROP CONSTRAINT "client_id_unique";--> statement-breakpoint
ALTER TABLE "client" DROP CONSTRAINT "client_user_pk" CASCADE;--> statement-breakpoint
ALTER TABLE "client" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "clientId" uuid DEFAULT uuid_generate_v4() NOT NULL;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "valid_from" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "valid_to" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_clientId_unique" UNIQUE("clientId");--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_version" UNIQUE("user_id","valid_to");--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "config_version" UNIQUE("user_id","valid_to");
