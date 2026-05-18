CREATE TABLE "invoice_year_count" (
	"user_id" uuid,
	"year" integer,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_year_count_pkey" PRIMARY KEY("user_id","year"),
	CONSTRAINT "chk_positive_year_count" CHECK ("count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "invoice_year_count" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_count" DROP CONSTRAINT "chk_invoice_count_year_count";--> statement-breakpoint
ALTER TABLE "invoice_count" DROP CONSTRAINT "chk_positive_year_count";--> statement-breakpoint
ALTER TABLE "invoice_count" DROP COLUMN "year_count";--> statement-breakpoint
ALTER TABLE "invoice_year_count" ADD CONSTRAINT "invoice_year_count_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
INSERT INTO "invoice_year_count" ("user_id", "year", "count")
SELECT "user_id", "issue_year", MAX("year_index")
FROM "invoice"
GROUP BY "user_id", "issue_year";--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "invoice_year_count" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "invoice_year_count"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "invoice_year_count" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select current_setting('app.user_id')::uuid = "invoice_year_count"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "invoice_year_count" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "invoice_year_count"."user_id")) WITH CHECK ((select current_setting('app.user_id')::uuid = "invoice_year_count"."user_id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "invoice_year_count" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);