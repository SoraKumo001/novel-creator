CREATE TABLE "embedding_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"dimensions" integer DEFAULT 1536 NOT NULL,
	"base_url" text,
	"api_key" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
