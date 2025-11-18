CREATE TABLE "client_preferences" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"is_favourite" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "preferences" uuid;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_preferences_client_preferences_id_fk" FOREIGN KEY ("preferences") REFERENCES "public"."client_preferences"("id") ON DELETE no action ON UPDATE no action;