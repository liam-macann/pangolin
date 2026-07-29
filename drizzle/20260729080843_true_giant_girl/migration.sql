ALTER TABLE "invoice_year_count" RENAME TO "sequencer";--> statement-breakpoint
ALTER TABLE "sequencer" RENAME COLUMN "year" TO "partition";--> statement-breakpoint
ALTER TABLE "sequencer" RENAME CONSTRAINT "chk_positive_year_count" TO "chk_positive_count";--> statement-breakpoint
ALTER TABLE "sequencer" RENAME CONSTRAINT "invoice_year_count_pkey" TO "sequencer_pkey";--> statement-breakpoint
ALTER POLICY "granular-crud-authenticated-policy-select" ON "sequencer" TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "sequencer"."user_id"));--> statement-breakpoint
ALTER POLICY "granular-crud-authenticated-policy-insert" ON "sequencer" TO "authenticated" WITH CHECK ((select current_setting('app.user_id')::uuid = "sequencer"."user_id"));--> statement-breakpoint
ALTER POLICY "granular-crud-authenticated-policy-update" ON "sequencer" TO "authenticated" USING ((select current_setting('app.user_id')::uuid = "sequencer"."user_id")) WITH CHECK ((select current_setting('app.user_id')::uuid = "sequencer"."user_id"));--> statement-breakpoint


ALTER TABLE "sequencer" ADD COLUMN "id" uuid DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "sequencer" DROP CONSTRAINT "sequencer_pkey";--> statement-breakpoint
ALTER TABLE "sequencer" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "sequencer" ALTER COLUMN "partition" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sequencer" ALTER COLUMN "partition" SET DATA TYPE varchar(50) USING "partition"::varchar(50);--> statement-breakpoint

CREATE UNIQUE INDEX "uq_sequencer_partitioned" ON "sequencer" ("user_id","partition") WHERE ("partition" is not null);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sequencer_global" ON "sequencer" ("user_id") WHERE ("partition" is null);--> statement-breakpoint

INSERT INTO sequencer (user_id, partition, count, updated_at)
SELECT user_id, NULL, count, updated_at
FROM invoice_count
ON CONFLICT (user_id) WHERE partition IS NULL DO UPDATE
SET count = EXCLUDED.count,
    updated_at = EXCLUDED.updated_at;--> statement-breakpoint

DROP POLICY "granular-crud-authenticated-policy-select" ON "invoice_count";--> statement-breakpoint
DROP POLICY "granular-crud-authenticated-policy-insert" ON "invoice_count";--> statement-breakpoint
DROP POLICY "granular-crud-authenticated-policy-update" ON "invoice_count";--> statement-breakpoint
DROP POLICY "granular-crud-authenticated-policy-delete" ON "invoice_count";--> statement-breakpoint
DROP TABLE "invoice_count";
