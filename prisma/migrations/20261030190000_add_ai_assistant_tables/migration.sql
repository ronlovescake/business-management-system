BEGIN;

CREATE TABLE public.ai_assistant_settings (
  id TEXT PRIMARY KEY,
  key VARCHAR(50) NOT NULL UNIQUE DEFAULT 'default',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activeProvider" VARCHAR(30) NOT NULL DEFAULT 'ollama',
  "activeModel" VARCHAR(120) NOT NULL DEFAULT 'qwen3:8b',
  "accountingModel" VARCHAR(120),
  "ollamaBaseUrl" VARCHAR(500) NOT NULL DEFAULT 'http://host.docker.internal:11434',
  "fallbackProvider" VARCHAR(30),
  "fallbackModel" VARCHAR(120),
  "allowCloudDataSharing" BOOLEAN NOT NULL DEFAULT false,
  "dailyTokenLimit" INTEGER NOT NULL DEFAULT 250000,
  "monthlyBudgetUsd" DECIMAL(10, 2) NOT NULL DEFAULT 15.00,
  "monitoringEnabled" BOOLEAN NOT NULL DEFAULT true,
  "morningBriefingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "morningBriefingTime" VARCHAR(5) NOT NULL DEFAULT '07:00',
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Manila',
  "updatedByUserId" VARCHAR(100)
);

CREATE TABLE public.ai_monitoring_alerts (
  id TEXT PRIMARY KEY,
  "dedupeKey" VARCHAR(255) NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "businessUnit" VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'WARNING',
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  title VARCHAR(255) NOT NULL,
  "deterministicSummary" TEXT NOT NULL,
  "aiExplanation" TEXT,
  "aiModelUsed" VARCHAR(120),
  "sourceLink" VARCHAR(500),
  "evidenceJson" JSONB,
  "acknowledgedBy" VARCHAR(100),
  "acknowledgedAt" TIMESTAMPTZ(6),
  "resolvedAt" TIMESTAMPTZ(6)
);

CREATE INDEX "ai_monitoring_alerts_businessUnit_status_severity_idx"
  ON public.ai_monitoring_alerts("businessUnit", status, severity);
CREATE INDEX "ai_monitoring_alerts_category_status_idx"
  ON public.ai_monitoring_alerts(category, status);
CREATE INDEX "ai_monitoring_alerts_lastDetectedAt_idx"
  ON public.ai_monitoring_alerts("lastDetectedAt");

CREATE TABLE public.ai_audit_logs (
  id TEXT PRIMARY KEY,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" VARCHAR(100),
  "userName" VARCHAR(255),
  "triggerSource" VARCHAR(50) NOT NULL,
  "businessUnit" VARCHAR(50),
  provider VARCHAR(30) NOT NULL,
  model VARCHAR(120) NOT NULL,
  "toolsCalled" JSONB,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostUsd" DECIMAL(12, 6) NOT NULL DEFAULT 0,
  "latencyMs" INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
  "errorMessage" VARCHAR(1000),
  metadata JSONB
);

CREATE INDEX "ai_audit_logs_createdAt_idx" ON public.ai_audit_logs("createdAt");
CREATE INDEX "ai_audit_logs_provider_createdAt_idx" ON public.ai_audit_logs(provider, "createdAt");
CREATE INDEX "ai_audit_logs_businessUnit_createdAt_idx" ON public.ai_audit_logs("businessUnit", "createdAt");
CREATE INDEX "ai_audit_logs_userId_createdAt_idx" ON public.ai_audit_logs("userId", "createdAt");

COMMIT;
