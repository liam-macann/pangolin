CREATE TABLE "config" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"timeZone" text DEFAULT 'Australia/Sydney' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;