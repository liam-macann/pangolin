ALTER TABLE "currency" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "timezone" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "currency" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "currency" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "currency" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "currency" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "timezone" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "timezone" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "timezone" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "timezone" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);