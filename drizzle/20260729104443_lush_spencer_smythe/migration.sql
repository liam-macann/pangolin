CREATE TYPE "namespace" AS ENUM('invoice');--> statement-breakpoint
DROP INDEX "uq_sequencer_partitioned";--> statement-breakpoint
DROP INDEX "uq_sequencer_global";--> statement-breakpoint
ALTER TABLE "sequencer" ADD COLUMN "namespace" "namespace" NOT NULL DEFAULT 'invoice';--> statement-breakpoint
ALTER TABLE "sequencer" ALTER COLUMN "namespace" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sequencer" ADD CONSTRAINT "uq_sequencer_user_series_partition" UNIQUE NULLS NOT DISTINCT("user_id","namespace","partition");
