CREATE TYPE "public"."color" AS ENUM('blue', 'grass', 'green', 'red', 'pink', 'lavender');--> statement-breakpoint
CREATE TYPE "public"."numbering_scheme" AS ENUM('sequential', 'annual');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('unpaid', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('items', 'hours');--> statement-breakpoint
CREATE TABLE "account" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "authenticator" (
	"credentialID" text NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_account_id" text NOT NULL,
	"credential_public_key" text NOT NULL,
	"counter" integer NOT NULL,
	"credential_device_type" text NOT NULL,
	"credential_backed_up" boolean NOT NULL,
	"transports" text,
	CONSTRAINT "authenticator_credentialID_unique" UNIQUE("credentialID")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"email_verified" timestamp,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "client_data" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	CONSTRAINT "client_data_user_unique" UNIQUE("id","user_id"),
	CONSTRAINT "client_version" UNIQUE("client_id","valid_to")
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "client_user_unique" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "config" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"timezone" text NOT NULL,
	"locale" text NOT NULL,
	"currency" varchar(3) NOT NULL,
	"tax_registration" boolean NOT NULL,
	"numbering_scheme" "numbering_scheme" NOT NULL,
	"color_scheme" "color" DEFAULT 'blue' NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	CONSTRAINT "config_version" UNIQUE("user_id","valid_to")
);
--> statement-breakpoint
CREATE TABLE "invoice_count" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"year_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_item" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"label" varchar(60) NOT NULL,
	"note" varchar(60),
	"quantity" numeric(8, 2) NOT NULL,
	"unit" "unit",
	"unit_cost" numeric(15, 4) NOT NULL,
	"net_amount" numeric(15, 4) GENERATED ALWAYS AS ("invoice_item"."quantity" * "invoice_item"."unit_cost") STORED NOT NULL,
	"order" integer
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_data_id" uuid NOT NULL,
	"title" varchar(100),
	"description" text,
	"status" "status" NOT NULL,
	"notes" text,
	"is_void" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_at" date NOT NULL,
	"issue_year" integer GENERATED ALWAYS AS (EXTRACT(YEAR FROM "invoice"."issued_at")) STORED NOT NULL,
	"due_at" date NOT NULL,
	"index" integer NOT NULL,
	"year_index" integer NOT NULL,
	"config_id" uuid NOT NULL,
	CONSTRAINT "user_index" UNIQUE("user_id","index"),
	CONSTRAINT "due_after_issued" CHECK ("invoice"."due_at" > "invoice"."issued_at")
);
--> statement-breakpoint
CREATE TABLE "item_tax" (
	"item_id" uuid NOT NULL,
	"tax_id" uuid NOT NULL,
	CONSTRAINT "item_tax_pkey" PRIMARY KEY("item_id","tax_id")
);
--> statement-breakpoint
CREATE TABLE "tax" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(10) NOT NULL,
	"rate" numeric(5, 4) NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"order" integer,
	CONSTRAINT "user_name_rate" UNIQUE("user_id","name","rate")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authenticator" ADD CONSTRAINT "authenticator_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_data" ADD CONSTRAINT "client_data_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_data" ADD CONSTRAINT "client_data_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_data" ADD CONSTRAINT "client_data_ownership_fk" FOREIGN KEY ("client_id","user_id") REFERENCES "public"."client"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_count" ADD CONSTRAINT "invoice_count_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_client_data_id_client_data_id_fk" FOREIGN KEY ("client_data_id") REFERENCES "public"."client_data"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_config_id_config_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_ownership_fk" FOREIGN KEY ("client_data_id","user_id") REFERENCES "public"."client_data"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tax" ADD CONSTRAINT "item_tax_item_id_invoice_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."invoice_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tax" ADD CONSTRAINT "item_tax_tax_id_tax_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."tax"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax" ADD CONSTRAINT "tax_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_year_yearindex" ON "invoice" USING btree ("user_id",EXTRACT(YEAR FROM "issued_at"),"year_index");--> statement-breakpoint
CREATE VIEW "public"."items_with_tax" AS (select "invoice_item"."id", "invoice_item"."invoice_id", "invoice_item"."label", "invoice_item"."note", "invoice_item"."quantity", "invoice_item"."unit", "invoice_item"."unit_cost", "invoice_item"."net_amount", "invoice_item"."order", "config"."tax_registration", ((1 + COALESCE(sum("tax"."rate") * "config"."tax_registration"::INT, 0)) * "invoice_item"."net_amount")::NUMERIC(15, 4) as "gross_amount" from "invoice_item" left join "item_tax" on "item_tax"."item_id" = "invoice_item"."id" left join "tax" on "item_tax"."tax_id" = "tax"."id" left join "invoice" on "invoice_item"."invoice_id" = "invoice"."id" left join "config" on "invoice"."config_id" = "config"."id" group by "invoice_item"."id", "config"."id");