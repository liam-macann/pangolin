ALTER TABLE "invoice" DROP CONSTRAINT "uq_invoice_user_index";--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT "chk_invoice_year_index";--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT "chk_positive_year_index";--> statement-breakpoint
DROP INDEX "uq_user_year_year_index";--> statement-breakpoint

ALTER TABLE "invoice" ADD COLUMN "partition" varchar(50);--> statement-breakpoint



-- Preserve existing invoice references:
-- sequential invoices keep their global index;
-- annual invoices use their historical year index and issue year partition.
UPDATE "invoice" AS i
SET
	"partition" = CASE
		WHEN c."numbering_scheme" = 'annual' THEN i."issue_year"::text
		ELSE NULL
	END,
	"index" = CASE
		WHEN c."numbering_scheme" = 'annual' THEN i."year_index"
		ELSE i."index"
	END
FROM "document" AS d
INNER JOIN "config" AS c ON c."id" = d."config_id"
WHERE d."id" = i."id";--> statement-breakpoint

-- Rebuild watermarks because the previous contract incremented both series
DELETE FROM "sequencer"
WHERE "namespace" = 'invoice'::"namespace";--> statement-breakpoint

INSERT INTO "sequencer" (
	"user_id",
	"namespace",
	"partition",
	"count",
	"updated_at"
)
SELECT
	"user_id",
	'invoice'::"namespace",
	"partition",
	MAX("index"),
	transaction_timestamp()
FROM "invoice"
GROUP BY "user_id", "partition";--> statement-breakpoint



ALTER TABLE "invoice" DROP COLUMN "issue_year";--> statement-breakpoint
ALTER TABLE "invoice" DROP COLUMN "year_index";--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "uq_invoice_user_partition_index" UNIQUE NULLS NOT DISTINCT("user_id","partition","index");
