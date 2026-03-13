ALTER TABLE "config" ADD COLUMN "trading_name" text;

UPDATE "config" AS c
SET "trading_name" = u."name"
FROM "user" AS u
WHERE c."user_id" = u."id";

ALTER TABLE "config" ALTER COLUMN "trading_name" SET NOT NULL;