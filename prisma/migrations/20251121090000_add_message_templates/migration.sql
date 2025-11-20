-- Create backing table for message templates so edits persist
CREATE TABLE IF NOT EXISTS "message_templates" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "badge" VARCHAR(100) NOT NULL,
  "paragraphs" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- Ensure columns stay in sync when the table already exists (e.g., dev databases)
ALTER TABLE "message_templates"
  ADD COLUMN IF NOT EXISTS "slug" VARCHAR(100) NOT NULL,
  ADD COLUMN IF NOT EXISTS "title" VARCHAR(255) NOT NULL,
  ADD COLUMN IF NOT EXISTS "badge" VARCHAR(100) NOT NULL,
  ADD COLUMN IF NOT EXISTS "paragraphs" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Match Prisma unique constraint on slug
CREATE UNIQUE INDEX IF NOT EXISTS "message_templates_slug_key"
  ON "message_templates" ("slug");
