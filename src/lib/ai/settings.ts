import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readLiveEnvValue } from './providers';
import {
  getOrCreateDefaultSettingRow,
  queryUsageSummaryFromStore,
  saveDefaultSettingRow,
} from './store';
import type {
  AiAssistantConfig,
  AiProviderCredentialStatus,
  AiProviderId,
  AiUsageSummary,
} from './types';

export const AI_PROVIDER_IDS: readonly AiProviderId[] = [
  'ollama',
  'google',
  'openai',
] as const;

export const updateAiAssistantSettingsSchema = z.object({
  activeProvider: z.enum(['ollama', 'google', 'openai']),
  activeModel: z
    .string()
    .trim()
    .min(1, 'Active model is required')
    .max(120)
    .regex(/^[a-zA-Z0-9._:-]+$/, 'Invalid model identifier format'),
  accountingModel: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-zA-Z0-9._:-]*$/, 'Invalid accounting model identifier format')
    .nullable()
    .optional(),
  ollamaBaseUrl: z
    .string()
    .trim()
    .url('Ollama endpoint must be a valid http/https URL')
    .max(500),
  fallbackProvider: z
    .enum(['ollama', 'google', 'openai'])
    .nullable()
    .optional(),
  fallbackModel: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-zA-Z0-9._:-]*$/, 'Invalid fallback model identifier format')
    .nullable()
    .optional(),
  allowCloudDataSharing: z.boolean(),
  dailyTokenLimit: z.number().int().min(1000).max(50000000),
  monthlyBudgetUsd: z.number().min(0).max(10000),
  monitoringEnabled: z.boolean(),
  morningBriefingEnabled: z.boolean(),
  morningBriefingTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM 24-hour format'),
  timezone: z.string().trim().min(1).max(50),
});

export type UpdateAiAssistantSettingsInput = z.infer<
  typeof updateAiAssistantSettingsSchema
>;

let tablesEnsured = false;

export async function ensureAiAssistantTables(): Promise<void> {
  if (tablesEnsured) {
    return;
  }
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.ai_assistant_settings (
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
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.ai_monitoring_alerts (
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
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
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
    `);
    tablesEnsured = true;
  } catch {
    // Ignore when mocked in unit tests without raw SQL support
  }
}

export function getProviderCredentialStatus(
  ollamaBaseUrl?: string
): AiProviderCredentialStatus {
  const effectiveOllama = (
    ollamaBaseUrl ||
    process.env.OLLAMA_BASE_URL ||
    'http://host.docker.internal:11434'
  ).trim();

  const geminiKey = readLiveEnvValue([
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'GEMINI_API_KEY',
  ]);

  const openAiKey = readLiveEnvValue(['OPENAI_API_KEY']);

  return {
    ollamaConfigured: Boolean(effectiveOllama),
    hasGeminiKey: Boolean(geminiKey),
    hasOpenAiKey: Boolean(openAiKey),
  };
}

export async function getAiUsageSummary(): Promise<AiUsageSummary> {
  const now = new Date();
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  const stats = await queryUsageSummaryFromStore(startOfDay, startOfMonth);

  return {
    todayInputTokens: stats.todayInputTokens,
    todayOutputTokens: stats.todayOutputTokens,
    todayTotalTokens: stats.todayInputTokens + stats.todayOutputTokens,
    monthEstimatedCostUsd: stats.monthEstimatedCostUsd,
    todayRequestCount: stats.todayRequestCount,
  };
}

export async function getAiAssistantSettings(): Promise<AiAssistantConfig> {
  await ensureAiAssistantTables();
  const defaultOllamaUrl = (
    process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434'
  ).trim();
  const credentials = getProviderCredentialStatus(defaultOllamaUrl);
  const hasOpenAiEnvKey = credentials.hasOpenAiKey;
  const hasGeminiEnvKey = credentials.hasGeminiKey;

  const initialProvider: AiProviderId = hasOpenAiEnvKey
    ? 'openai'
    : hasGeminiEnvKey
      ? 'google'
      : 'ollama';
  const initialModel = hasOpenAiEnvKey
    ? 'gpt-4o-mini'
    : hasGeminiEnvKey
      ? 'gemini-3.8-flash'
      : 'qwen3:8b';

  const record = await getOrCreateDefaultSettingRow({
    activeProvider: initialProvider,
    activeModel: initialModel,
    ollamaBaseUrl: defaultOllamaUrl,
    allowCloudDataSharing: hasOpenAiEnvKey || hasGeminiEnvKey,
  });

  // Auto-switch to OpenAI when OPENAI_API_KEY is configured and the previous setting was Google or initial Ollama
  if (
    hasOpenAiEnvKey &&
    (record.activeProvider === 'google' ||
      (record.activeProvider === 'ollama' && !record.updatedByUserId))
  ) {
    const upgraded = await saveDefaultSettingRow({
      activeProvider: 'openai',
      activeModel: 'gpt-4o-mini',
      accountingModel: record.accountingModel,
      ollamaBaseUrl: record.ollamaBaseUrl,
      fallbackProvider: record.fallbackProvider,
      fallbackModel: record.fallbackModel,
      allowCloudDataSharing: true,
      dailyTokenLimit: record.dailyTokenLimit,
      monthlyBudgetUsd: Number(record.monthlyBudgetUsd),
      monitoringEnabled: record.monitoringEnabled,
      morningBriefingEnabled: record.morningBriefingEnabled,
      morningBriefingTime: record.morningBriefingTime,
      timezone: record.timezone,
      updatedByUserId: record.updatedByUserId,
    });
    Object.assign(record, upgraded);
  } else if (
    !hasOpenAiEnvKey &&
    hasGeminiEnvKey &&
    (record.activeProvider === 'openai' ||
      (record.activeProvider === 'ollama' && !record.updatedByUserId) ||
      (record.activeProvider === 'google' &&
        record.activeModel !== 'gemini-3.8-flash'))
  ) {
    const upgraded = await saveDefaultSettingRow({
      activeProvider: 'google',
      activeModel: 'gemini-3.8-flash',
      accountingModel: record.accountingModel,
      ollamaBaseUrl: record.ollamaBaseUrl,
      fallbackProvider: record.fallbackProvider,
      fallbackModel: record.fallbackModel,
      allowCloudDataSharing: true,
      dailyTokenLimit: record.dailyTokenLimit,
      monthlyBudgetUsd: Number(record.monthlyBudgetUsd),
      monitoringEnabled: record.monitoringEnabled,
      morningBriefingEnabled: record.morningBriefingEnabled,
      morningBriefingTime: record.morningBriefingTime,
      timezone: record.timezone,
      updatedByUserId: record.updatedByUserId,
    });
    Object.assign(record, upgraded);
  }

  const usage = await getAiUsageSummary();
  const finalCredentials = getProviderCredentialStatus(record.ollamaBaseUrl);

  return {
    id: record.id,
    key: record.key,
    activeProvider: (record.activeProvider as AiProviderId) || 'ollama',
    activeModel: record.activeModel,
    accountingModel: record.accountingModel,
    ollamaBaseUrl: record.ollamaBaseUrl,
    fallbackProvider: (record.fallbackProvider as AiProviderId | null) ?? null,
    fallbackModel: record.fallbackModel ?? null,
    allowCloudDataSharing: record.allowCloudDataSharing,
    dailyTokenLimit: record.dailyTokenLimit,
    monthlyBudgetUsd: Number(record.monthlyBudgetUsd),
    monitoringEnabled: record.monitoringEnabled,
    morningBriefingEnabled: record.morningBriefingEnabled,
    morningBriefingTime: record.morningBriefingTime,
    timezone: record.timezone,
    updatedAt: new Date(record.updatedAt).toISOString(),
    updatedByUserId: record.updatedByUserId,
    credentials: finalCredentials,
    usage,
  };
}

export async function updateAiAssistantSettings(
  rawInput: unknown,
  updatedByUserId: string | null
): Promise<AiAssistantConfig> {
  await ensureAiAssistantTables();
  const parsed = updateAiAssistantSettingsSchema.parse(rawInput);

  // Enforce privacy invariant: cannot set fallback to a cloud provider unless cloud sharing is enabled
  if (
    !parsed.allowCloudDataSharing &&
    parsed.fallbackProvider &&
    parsed.fallbackProvider !== 'ollama'
  ) {
    throw new Error(
      'Cannot configure a cloud fallback provider while Cloud Data Sharing is disabled.'
    );
  }

  await saveDefaultSettingRow({
    activeProvider: parsed.activeProvider,
    activeModel: parsed.activeModel,
    accountingModel: parsed.accountingModel || null,
    ollamaBaseUrl: parsed.ollamaBaseUrl.replace(/\/+$/, ''),
    fallbackProvider: parsed.fallbackProvider || null,
    fallbackModel: parsed.fallbackModel || null,
    allowCloudDataSharing: parsed.allowCloudDataSharing,
    dailyTokenLimit: parsed.dailyTokenLimit,
    monthlyBudgetUsd: parsed.monthlyBudgetUsd,
    monitoringEnabled: parsed.monitoringEnabled,
    morningBriefingEnabled: parsed.morningBriefingEnabled,
    morningBriefingTime: parsed.morningBriefingTime,
    timezone: parsed.timezone,
    updatedByUserId,
  });

  return getAiAssistantSettings();
}
