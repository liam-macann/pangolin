-- Custom SQL migration file, put your code below! --
ALTER TABLE "config" DROP CONSTRAINT IF EXISTS "uq_config_version";

ALTER TABLE "config" 
ADD CONSTRAINT "uq_config_version" 
UNIQUE NULLS NOT DISTINCT ("user_id", "valid_to");


ALTER TABLE "client_data" DROP CONSTRAINT IF EXISTS "uq_client_version";

ALTER TABLE "client_data" 
ADD CONSTRAINT "uq_client_version" 
UNIQUE NULLS NOT DISTINCT ("client_id", "valid_to");