CREATE TABLE "invoice_count" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"yearCount" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "config" DROP CONSTRAINT "config_pkey";--> statement-breakpoint
ALTER TABLE "config" ALTER COLUMN "timezone" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "config" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL;--> statement-breakpoint
ALTER TABLE "config" ADD COLUMN "valid_from" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "config" ADD COLUMN "valid_to" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "yearIndex" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "config_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_count" ADD CONSTRAINT "invoice_count_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_config_id_config_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "user_index" UNIQUE("user_id","index");
