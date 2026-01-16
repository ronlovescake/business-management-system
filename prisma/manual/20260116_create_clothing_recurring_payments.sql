-- Manual migration: Clothing recurring payments (templates + drafts)
--
-- Why manual:
-- - Prisma migrate is currently blocked by drift in this environment.
-- - This script provides a non-destructive way to align DB schema.
--
-- Tables:
-- - clothing_recurring_payment_templates
-- - clothing_recurring_payment_drafts

BEGIN;

-- 1) Create tables if missing
CREATE TABLE IF NOT EXISTS clothing_recurring_payment_templates (
  id text PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  name varchar(255) NOT NULL,
  kind varchar(30) NOT NULL,
  amount double precision NOT NULL DEFAULT 0,
  frequency varchar(30) NOT NULL DEFAULT 'MONTHLY',
  "dayOfMonth" integer NOT NULL,
  "nextDueDate" timestamptz NOT NULL,
  "endDate" timestamptz NULL,
  "debitAccount" varchar(255) NOT NULL,
  "debitTag" varchar(255) NULL,
  "creditAccount" varchar(255) NOT NULL,
  "creditTag" varchar(255) NULL,
  notes varchar(1000) NULL,
  "isActive" boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS clothing_recurring_payment_drafts (
  id text PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "templateId" text NOT NULL,
  "dueDate" timestamptz NOT NULL,
  amount double precision NOT NULL DEFAULT 0,
  "debitAccount" varchar(255) NOT NULL,
  "debitTag" varchar(255) NULL,
  "creditAccount" varchar(255) NOT NULL,
  "creditTag" varchar(255) NULL,
  ref varchar(120) NOT NULL,
  description varchar(1000) NULL,
  status varchar(30) NOT NULL DEFAULT 'DRAFT',
  "approvedAt" timestamptz NULL,
  CONSTRAINT clothing_recurring_payment_drafts_template_fkey
    FOREIGN KEY ("templateId")
    REFERENCES clothing_recurring_payment_templates(id)
    ON DELETE CASCADE
);

-- 2) Backward-compatible renames (if an earlier version used unquoted lowercase column names)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_templates' AND column_name='createdat'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_templates RENAME COLUMN createdat TO "createdAt"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_templates' AND column_name='updatedat'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_templates RENAME COLUMN updatedat TO "updatedAt"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_templates' AND column_name='dayofmonth'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_templates RENAME COLUMN dayofmonth TO "dayOfMonth"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_templates' AND column_name='nextduedate'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_templates RENAME COLUMN nextduedate TO "nextDueDate"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_templates' AND column_name='enddate'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_templates RENAME COLUMN enddate TO "endDate"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_templates' AND column_name='debitaccount'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_templates RENAME COLUMN debitaccount TO "debitAccount"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_templates' AND column_name='debittag'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_templates RENAME COLUMN debittag TO "debitTag"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_templates' AND column_name='creditaccount'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_templates RENAME COLUMN creditaccount TO "creditAccount"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_templates' AND column_name='credittag'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_templates RENAME COLUMN credittag TO "creditTag"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_templates' AND column_name='isactive'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_templates RENAME COLUMN isactive TO "isActive"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_drafts' AND column_name='createdat'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_drafts RENAME COLUMN createdat TO "createdAt"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_drafts' AND column_name='updatedat'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_drafts RENAME COLUMN updatedat TO "updatedAt"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_drafts' AND column_name='templateid'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_drafts RENAME COLUMN templateid TO "templateId"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_drafts' AND column_name='duedate'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_drafts RENAME COLUMN duedate TO "dueDate"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_drafts' AND column_name='debitaccount'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_drafts RENAME COLUMN debitaccount TO "debitAccount"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_drafts' AND column_name='creditaccount'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_drafts RENAME COLUMN creditaccount TO "creditAccount"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clothing_recurring_payment_drafts' AND column_name='approvedat'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_drafts RENAME COLUMN approvedat TO "approvedAt"';
  END IF;
END $$;

-- 3) Ensure tag columns exist on drafts
ALTER TABLE clothing_recurring_payment_drafts
  ADD COLUMN IF NOT EXISTS "debitTag" varchar(255),
  ADD COLUMN IF NOT EXISTS "creditTag" varchar(255);

-- 4) Indexes and uniqueness
CREATE INDEX IF NOT EXISTS clothing_recurring_payment_templates_is_active_idx
  ON clothing_recurring_payment_templates("isActive");
CREATE INDEX IF NOT EXISTS clothing_recurring_payment_templates_next_due_date_idx
  ON clothing_recurring_payment_templates("nextDueDate");
CREATE INDEX IF NOT EXISTS clothing_recurring_payment_templates_kind_idx
  ON clothing_recurring_payment_templates(kind);

CREATE INDEX IF NOT EXISTS clothing_recurring_payment_drafts_status_idx
  ON clothing_recurring_payment_drafts(status);
CREATE INDEX IF NOT EXISTS clothing_recurring_payment_drafts_due_date_idx
  ON clothing_recurring_payment_drafts("dueDate");
CREATE INDEX IF NOT EXISTS clothing_recurring_payment_drafts_template_id_idx
  ON clothing_recurring_payment_drafts("templateId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clothing_recurring_payment_drafts_template_due_unique'
  ) THEN
    EXECUTE 'ALTER TABLE clothing_recurring_payment_drafts ADD CONSTRAINT clothing_recurring_payment_drafts_template_due_unique UNIQUE ("templateId", "dueDate")';
  END IF;
END $$;

COMMIT;
