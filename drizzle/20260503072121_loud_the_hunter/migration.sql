ALTER TABLE "client_data" DROP CONSTRAINT "uq_client_version";--> statement-breakpoint
ALTER TABLE "config" DROP CONSTRAINT "uq_config_version";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_client_active_version" ON "client_data" ("client_id") WHERE ("valid_to" is null);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_config_active_version" ON "config" ("user_id") WHERE ("valid_to" is null);