-- Custom SQL migration file, put your code below! --

ALTER TABLE "keychain"
ALTER COLUMN "key" SET DATA TYPE bytea
USING "key"::bytea;
