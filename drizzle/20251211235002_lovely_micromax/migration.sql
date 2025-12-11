CREATE TABLE "timezone" (
	"name" text PRIMARY KEY
);

INSERT INTO "timezone" ("name")
SELECT "name" FROM "pg_timezone_names"
ON CONFLICT DO NOTHING;--> statement-breakpoint

--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "config_timezone_timezone_name_fkey" FOREIGN KEY ("timezone") REFERENCES "timezone"("name");--> statement-breakpoint