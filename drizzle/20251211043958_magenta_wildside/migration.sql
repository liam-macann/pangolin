CREATE TABLE "currency" (
	"iso" char(3) PRIMARY KEY,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
