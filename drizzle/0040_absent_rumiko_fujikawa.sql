ALTER TABLE "client" RENAME COLUMN "clientId" TO "client_id";--> statement-breakpoint
ALTER TABLE "client" DROP CONSTRAINT "client_clientId_unique";--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_client_id_unique" UNIQUE("client_id");