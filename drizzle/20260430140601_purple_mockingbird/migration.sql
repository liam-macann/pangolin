ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "keychain" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "account" AS PERMISSIVE FOR SELECT TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "account" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "account" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "account" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "keychain" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "keychain"."id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "keychain" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select current_setting('app.user_id')::uuid = "keychain"."id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "keychain" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "keychain" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "session" AS PERMISSIVE FOR SELECT TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "session" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "session" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "session" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "user" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "user"."id"));--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "user" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "user" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "user" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-select" ON "verification" AS PERMISSIVE FOR SELECT TO "authenticated" USING (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-insert" ON "verification" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-update" ON "verification" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "granular-crud-authenticated-policy-delete" ON "verification" AS PERMISSIVE FOR DELETE TO "authenticated" USING (false);