CREATE TYPE "public"."color" AS ENUM('blue', 'grass', 'green', 'red', 'pink', 'lavender');--> statement-breakpoint
CREATE TYPE "public"."numbering_scheme" AS ENUM('sequential', 'annual');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('unpaid', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('items', 'hours');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	CONSTRAINT "uq_client_data_user" UNIQUE("id","user_id"),
	CONSTRAINT "uq_client_version" UNIQUE("client_id","valid_to"),
	CONSTRAINT "chk_client_data_valid" CHECK ("client_data"."valid_from" <= now())
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "uq_client_user" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"timezone" text NOT NULL,
	"locale" text NOT NULL,
	"currency" varchar(3) NOT NULL,
	"tax_registration" boolean NOT NULL,
	"numbering_scheme" "numbering_scheme" NOT NULL,
	"color_scheme" "color" DEFAULT 'blue' NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	CONSTRAINT "uq_config_version" UNIQUE("user_id","valid_to"),
	CONSTRAINT "chk_config_valid" CHECK ("config"."valid_from" <= now())
);
--> statement-breakpoint
CREATE TABLE "config_tax" (
	"order" integer NOT NULL,
	"config_id" uuid NOT NULL,
	"tax_id" uuid NOT NULL,
	CONSTRAINT "pk_config_tax" PRIMARY KEY("config_id","tax_id"),
	CONSTRAINT "uq_config_tax_order" UNIQUE("config_id","order")
);
--> statement-breakpoint
CREATE TABLE "tax" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(10) NOT NULL,
	"rate" numeric(5, 4) NOT NULL
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"label" varchar(60) NOT NULL,
	"note" varchar(60),
	"quantity" numeric(8, 2) NOT NULL,
	"unit" "unit",
	"unit_cost" numeric(15, 4) NOT NULL,
	"net_amount" numeric(15, 4) GENERATED ALWAYS AS ("invoice_item"."quantity" * "invoice_item"."unit_cost") STORED NOT NULL,
	"order" integer,
	"config_id" uuid NOT NULL,
	CONSTRAINT "uq_invoice_item_id_config" UNIQUE("id","config_id")
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	CONSTRAINT "uq_invoice_id_config" UNIQUE("id","config_id"),
	CONSTRAINT "uq_invoice_user_index" UNIQUE("user_id","index"),
	CONSTRAINT "chk_due_after_issued" CHECK ("invoice"."due_at" > "invoice"."issued_at")
);
--> statement-breakpoint
CREATE TABLE "item_tax" (
	"item_id" uuid NOT NULL,
	"tax_id" uuid NOT NULL,
	"config_id" uuid NOT NULL,
	CONSTRAINT "item_tax_pkey" PRIMARY KEY("item_id","tax_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_data" ADD CONSTRAINT "client_data_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_data" ADD CONSTRAINT "client_data_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_data" ADD CONSTRAINT "fk_client_data_ownership" FOREIGN KEY ("client_id","user_id") REFERENCES "public"."client"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_tax" ADD CONSTRAINT "config_tax_config_id_config_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_tax" ADD CONSTRAINT "config_tax_tax_id_tax_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."tax"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax" ADD CONSTRAINT "tax_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_count" ADD CONSTRAINT "invoice_count_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_config_id_config_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "fk_invoice_item_invoice_config" FOREIGN KEY ("invoice_id","config_id") REFERENCES "public"."invoice"("id","config_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_client_data_id_client_data_id_fk" FOREIGN KEY ("client_data_id") REFERENCES "public"."client_data"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_config_id_config_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "fk_invoice_client" FOREIGN KEY ("client_data_id","user_id") REFERENCES "public"."client_data"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tax" ADD CONSTRAINT "item_tax_item_id_invoice_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."invoice_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tax" ADD CONSTRAINT "item_tax_tax_id_tax_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."tax"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tax" ADD CONSTRAINT "item_tax_config_id_config_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tax" ADD CONSTRAINT "fk_item_tax_invoice_item" FOREIGN KEY ("item_id","config_id") REFERENCES "public"."invoice_item"("id","config_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_tax" ADD CONSTRAINT "fk_item_tax_config_tax" FOREIGN KEY ("config_id","tax_id") REFERENCES "public"."config_tax"("config_id","tax_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_year_year_index" ON "invoice" USING btree ("user_id",EXTRACT(YEAR FROM "issued_at"),"year_index");