import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

function genId(): string {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface SettingRow {
  id: string;
  key: string;
  createdAt: Date;
  updatedAt: Date;
  activeProvider: string;
  activeModel: string;
  accountingModel: string | null;
  ollamaBaseUrl: string;
  fallbackProvider: string | null;
  fallbackModel: string | null;
  allowCloudDataSharing: boolean;
  dailyTokenLimit: number;
  monthlyBudgetUsd: number | string;
  monitoringEnabled: boolean;
  morningBriefingEnabled: boolean;
  morningBriefingTime: string;
  timezone: string;
  updatedByUserId: string | null;
}

export interface AuditLogStoreRow {
  id: string;
  createdAt: Date;
  userId: string | null;
  userName: string | null;
  triggerSource: string;
  businessUnit: string | null;
  provider: string;
  model: string;
  toolsCalled: unknown;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | string;
  latencyMs: number;
  status: string;
  errorMessage: string | null;
  metadata: unknown;
}

export interface MonitoringAlertStoreRow {
  id: string;
  dedupeKey: string;
  createdAt: Date;
  updatedAt: Date;
  lastDetectedAt: Date;
  businessUnit: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  deterministicSummary: string;
  aiExplanation: string | null;
  aiModelUsed: string | null;
  sourceLink: string | null;
  evidenceJson: unknown;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
}

export async function getOrCreateDefaultSettingRow(defaults: {
  activeProvider: string;
  activeModel: string;
  ollamaBaseUrl: string;
  allowCloudDataSharing: boolean;
}): Promise<SettingRow> {
  if (typeof prisma.aiAssistantSetting?.upsert === 'function') {
    const row = await prisma.aiAssistantSetting.upsert({
      where: { key: 'default' },
      update: {},
      create: {
        key: 'default',
        activeProvider: defaults.activeProvider,
        activeModel: defaults.activeModel,
        ollamaBaseUrl: defaults.ollamaBaseUrl,
        allowCloudDataSharing: defaults.allowCloudDataSharing,
        dailyTokenLimit: 250000,
        monthlyBudgetUsd: 15.0,
        monitoringEnabled: true,
        morningBriefingEnabled: true,
        morningBriefingTime: '07:00',
        timezone: 'Asia/Manila',
      },
    });
    return {
      ...row,
      monthlyBudgetUsd: Number(row.monthlyBudgetUsd),
    };
  }

  const id = genId();
  const rows = await prisma.$queryRaw<SettingRow[]>`
    INSERT INTO public.ai_assistant_settings (
      id, key, "activeProvider", "activeModel", "ollamaBaseUrl", "allowCloudDataSharing"
    )
    VALUES (
      ${id}, 'default', ${defaults.activeProvider}, ${defaults.activeModel}, ${defaults.ollamaBaseUrl}, ${defaults.allowCloudDataSharing}
    )
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key
    RETURNING *
  `;
  return rows[0];
}

export async function saveDefaultSettingRow(data: {
  activeProvider: string;
  activeModel: string;
  accountingModel: string | null;
  ollamaBaseUrl: string;
  fallbackProvider: string | null;
  fallbackModel: string | null;
  allowCloudDataSharing: boolean;
  dailyTokenLimit: number;
  monthlyBudgetUsd: number;
  monitoringEnabled: boolean;
  morningBriefingEnabled: boolean;
  morningBriefingTime: string;
  timezone: string;
  updatedByUserId: string | null;
}): Promise<void> {
  if (typeof prisma.aiAssistantSetting?.upsert === 'function') {
    await prisma.aiAssistantSetting.upsert({
      where: { key: 'default' },
      update: data,
      create: { key: 'default', ...data },
    });
    return;
  }

  const id = genId();
  await prisma.$executeRaw`
    INSERT INTO public.ai_assistant_settings (
      id, key, "updatedAt", "activeProvider", "activeModel", "accountingModel",
      "ollamaBaseUrl", "fallbackProvider", "fallbackModel", "allowCloudDataSharing",
      "dailyTokenLimit", "monthlyBudgetUsd", "monitoringEnabled",
      "morningBriefingEnabled", "morningBriefingTime", timezone, "updatedByUserId"
    )
    VALUES (
      ${id}, 'default', CURRENT_TIMESTAMP, ${data.activeProvider}, ${data.activeModel},
      ${data.accountingModel}, ${data.ollamaBaseUrl}, ${data.fallbackProvider},
      ${data.fallbackModel}, ${data.allowCloudDataSharing}, ${data.dailyTokenLimit},
      ${data.monthlyBudgetUsd}, ${data.monitoringEnabled}, ${data.morningBriefingEnabled},
      ${data.morningBriefingTime}, ${data.timezone}, ${data.updatedByUserId}
    )
    ON CONFLICT (key) DO UPDATE SET
      "updatedAt" = CURRENT_TIMESTAMP,
      "activeProvider" = EXCLUDED."activeProvider",
      "activeModel" = EXCLUDED."activeModel",
      "accountingModel" = EXCLUDED."accountingModel",
      "ollamaBaseUrl" = EXCLUDED."ollamaBaseUrl",
      "fallbackProvider" = EXCLUDED."fallbackProvider",
      "fallbackModel" = EXCLUDED."fallbackModel",
      "allowCloudDataSharing" = EXCLUDED."allowCloudDataSharing",
      "dailyTokenLimit" = EXCLUDED."dailyTokenLimit",
      "monthlyBudgetUsd" = EXCLUDED."monthlyBudgetUsd",
      "monitoringEnabled" = EXCLUDED."monitoringEnabled",
      "morningBriefingEnabled" = EXCLUDED."morningBriefingEnabled",
      "morningBriefingTime" = EXCLUDED."morningBriefingTime",
      timezone = EXCLUDED.timezone,
      "updatedByUserId" = EXCLUDED."updatedByUserId"
  `;
}

export async function queryUsageSummaryFromStore(
  startOfDay: Date,
  startOfMonth: Date
): Promise<{
  todayInputTokens: number;
  todayOutputTokens: number;
  todayRequestCount: number;
  monthEstimatedCostUsd: number;
}> {
  if (typeof prisma.aiAuditLog?.aggregate === 'function') {
    const [todayAgg, monthAgg] = await Promise.all([
      prisma.aiAuditLog.aggregate({
        where: { createdAt: { gte: startOfDay } },
        _sum: { inputTokens: true, outputTokens: true },
        _count: { id: true },
      }),
      prisma.aiAuditLog.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { estimatedCostUsd: true },
      }),
    ]);
    return {
      todayInputTokens: todayAgg._sum.inputTokens ?? 0,
      todayOutputTokens: todayAgg._sum.outputTokens ?? 0,
      todayRequestCount: todayAgg._count.id ?? 0,
      monthEstimatedCostUsd: monthAgg._sum.estimatedCostUsd
        ? Number(monthAgg._sum.estimatedCostUsd)
        : 0,
    };
  }

  const [todayRows, monthRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        input_tokens: bigint | number | null;
        output_tokens: bigint | number | null;
        req_count: bigint | number | null;
      }>
    >`
      SELECT
        COALESCE(SUM("inputTokens"), 0) AS input_tokens,
        COALESCE(SUM("outputTokens"), 0) AS output_tokens,
        COUNT(id) AS req_count
      FROM public.ai_audit_logs
      WHERE "createdAt" >= ${startOfDay}
    `,
    prisma.$queryRaw<Array<{ total_cost: string | number | null }>>`
      SELECT COALESCE(SUM("estimatedCostUsd"), 0) AS total_cost
      FROM public.ai_audit_logs
      WHERE "createdAt" >= ${startOfMonth}
    `,
  ]);

  return {
    todayInputTokens: Number(todayRows[0]?.input_tokens ?? 0),
    todayOutputTokens: Number(todayRows[0]?.output_tokens ?? 0),
    todayRequestCount: Number(todayRows[0]?.req_count ?? 0),
    monthEstimatedCostUsd: Number(monthRows[0]?.total_cost ?? 0),
  };
}

export async function listRecentAuditLogsFromStore(
  limit = 25
): Promise<AuditLogStoreRow[]> {
  if (typeof prisma.aiAuditLog?.findMany === 'function') {
    const rows = await prisma.aiAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      ...r,
      estimatedCostUsd: Number(r.estimatedCostUsd),
    }));
  }

  return prisma.$queryRaw<AuditLogStoreRow[]>`
    SELECT * FROM public.ai_audit_logs
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;
}

export async function insertAuditLogToStore(data: {
  userId: string | null;
  userName: string | null;
  triggerSource: string;
  businessUnit: string | null;
  provider: string;
  model: string;
  toolsCalled?: unknown;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  latencyMs?: number;
  status: string;
  errorMessage?: string | null;
  metadata?: unknown;
}): Promise<void> {
  if (typeof prisma.aiAuditLog?.create === 'function') {
    await prisma.aiAuditLog.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        triggerSource: data.triggerSource,
        businessUnit: data.businessUnit,
        provider: data.provider,
        model: data.model,
        toolsCalled: (data.toolsCalled ?? undefined) as object | undefined,
        inputTokens: data.inputTokens ?? 0,
        outputTokens: data.outputTokens ?? 0,
        estimatedCostUsd: data.estimatedCostUsd ?? 0,
        latencyMs: data.latencyMs ?? 0,
        status: data.status,
        errorMessage: data.errorMessage ?? null,
        metadata: (data.metadata ?? undefined) as object | undefined,
      },
    });
    return;
  }

  const id = genId();
  const toolsJson = JSON.stringify(data.toolsCalled ?? []);
  const metaJson = JSON.stringify(data.metadata ?? {});
  await prisma.$executeRaw`
    INSERT INTO public.ai_audit_logs (
      id, "userId", "userName", "triggerSource", "businessUnit", provider, model,
      "toolsCalled", "inputTokens", "outputTokens", "estimatedCostUsd", "latencyMs",
      status, "errorMessage", metadata
    )
    VALUES (
      ${id}, ${data.userId}, ${data.userName}, ${data.triggerSource}, ${data.businessUnit},
      ${data.provider}, ${data.model}, ${toolsJson}::jsonb, ${data.inputTokens ?? 0},
      ${data.outputTokens ?? 0}, ${data.estimatedCostUsd ?? 0}, ${data.latencyMs ?? 0},
      ${data.status}, ${data.errorMessage ?? null}, ${metaJson}::jsonb
    )
  `;
}

export async function listMonitoringAlertsFromStore(params: {
  businessUnits: string[];
  status?: string;
  limit?: number;
}): Promise<MonitoringAlertStoreRow[]> {
  const limit = params.limit ?? 100;
  if (typeof prisma.aiMonitoringAlert?.findMany === 'function') {
    return prisma.aiMonitoringAlert.findMany({
      where: {
        businessUnit: { in: params.businessUnits },
        ...(params.status && params.status !== 'ALL'
          ? { status: params.status }
          : {}),
      },
      orderBy: [{ severity: 'asc' }, { lastDetectedAt: 'desc' }],
      take: limit,
    });
  }

  if (params.status && params.status !== 'ALL') {
    return prisma.$queryRaw<MonitoringAlertStoreRow[]>`
      SELECT * FROM public.ai_monitoring_alerts
      WHERE "businessUnit" = ANY(${params.businessUnits}::text[])
        AND status = ${params.status}
      ORDER BY severity ASC, "lastDetectedAt" DESC
      LIMIT ${limit}
    `;
  }

  return prisma.$queryRaw<MonitoringAlertStoreRow[]>`
    SELECT * FROM public.ai_monitoring_alerts
    WHERE "businessUnit" = ANY(${params.businessUnits}::text[])
    ORDER BY severity ASC, "lastDetectedAt" DESC
    LIMIT ${limit}
  `;
}

export async function findMonitoringAlertByIdFromStore(
  id: string
): Promise<MonitoringAlertStoreRow | null> {
  if (typeof prisma.aiMonitoringAlert?.findUnique === 'function') {
    return prisma.aiMonitoringAlert.findUnique({ where: { id } });
  }
  const rows = await prisma.$queryRaw<MonitoringAlertStoreRow[]>`
    SELECT * FROM public.ai_monitoring_alerts WHERE id = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function updateMonitoringAlertExplanationInStore(
  id: string,
  aiExplanation: string,
  aiModelUsed: string
): Promise<MonitoringAlertStoreRow> {
  if (typeof prisma.aiMonitoringAlert?.update === 'function') {
    return prisma.aiMonitoringAlert.update({
      where: { id },
      data: { aiExplanation, aiModelUsed },
    });
  }
  const rows = await prisma.$queryRaw<MonitoringAlertStoreRow[]>`
    UPDATE public.ai_monitoring_alerts
    SET "aiExplanation" = ${aiExplanation},
        "aiModelUsed" = ${aiModelUsed},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0];
}

export async function updateMonitoringAlertStatusInStore(params: {
  id: string;
  status: 'ACKNOWLEDGED' | 'RESOLVED';
  acknowledgedBy: string;
}): Promise<MonitoringAlertStoreRow> {
  const now = new Date();
  if (typeof prisma.aiMonitoringAlert?.update === 'function') {
    return prisma.aiMonitoringAlert.update({
      where: { id: params.id },
      data: {
        status: params.status,
        acknowledgedBy: params.acknowledgedBy,
        acknowledgedAt: now,
        ...(params.status === 'RESOLVED' ? { resolvedAt: now } : {}),
      },
    });
  }
  const resolvedAt = params.status === 'RESOLVED' ? now : null;
  const rows = await prisma.$queryRaw<MonitoringAlertStoreRow[]>`
    UPDATE public.ai_monitoring_alerts
    SET status = ${params.status},
        "acknowledgedBy" = ${params.acknowledgedBy},
        "acknowledgedAt" = ${now},
        "resolvedAt" = COALESCE(${resolvedAt}, "resolvedAt"),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${params.id}
    RETURNING *
  `;
  return rows[0];
}

export async function upsertMonitoringAlertInStore(item: {
  dedupeKey: string;
  businessUnit: string;
  category: string;
  severity: string;
  title: string;
  deterministicSummary: string;
  sourceLink: string;
  evidenceJson: Record<string, unknown>;
  now: Date;
}): Promise<void> {
  if (typeof prisma.aiMonitoringAlert?.upsert === 'function') {
    await prisma.aiMonitoringAlert.upsert({
      where: { dedupeKey: item.dedupeKey },
      update: {
        lastDetectedAt: item.now,
        severity: item.severity,
        title: item.title,
        deterministicSummary: item.deterministicSummary,
        sourceLink: item.sourceLink,
        evidenceJson: item.evidenceJson as object,
      },
      create: {
        dedupeKey: item.dedupeKey,
        businessUnit: item.businessUnit,
        category: item.category,
        severity: item.severity,
        status: 'OPEN',
        title: item.title,
        deterministicSummary: item.deterministicSummary,
        sourceLink: item.sourceLink,
        evidenceJson: item.evidenceJson as object,
        lastDetectedAt: item.now,
      },
    });
    return;
  }

  const id = genId();
  const evidenceStr = JSON.stringify(item.evidenceJson ?? {});
  await prisma.$executeRaw`
    INSERT INTO public.ai_monitoring_alerts (
      id, "dedupeKey", "lastDetectedAt", "businessUnit", category, severity,
      status, title, "deterministicSummary", "sourceLink", "evidenceJson"
    )
    VALUES (
      ${id}, ${item.dedupeKey}, ${item.now}, ${item.businessUnit}, ${item.category},
      ${item.severity}, 'OPEN', ${item.title}, ${item.deterministicSummary},
      ${item.sourceLink}, ${evidenceStr}::jsonb
    )
    ON CONFLICT ("dedupeKey") DO UPDATE SET
      "updatedAt" = CURRENT_TIMESTAMP,
      "lastDetectedAt" = EXCLUDED."lastDetectedAt",
      severity = EXCLUDED.severity,
      title = EXCLUDED.title,
      "deterministicSummary" = EXCLUDED."deterministicSummary",
      "sourceLink" = EXCLUDED."sourceLink",
      "evidenceJson" = EXCLUDED."evidenceJson"
  `;
}

export type ClothingAlertSnapshot = Pick<
  MonitoringAlertStoreRow,
  'id' | 'dedupeKey' | 'evidenceJson'
> & { updatedAtToken: string };

export async function getOpenClothingTransactionAlertsInStore(
  client: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma
): Promise<ClothingAlertSnapshot[]> {
  return client.$queryRaw<ClothingAlertSnapshot[]>`
    SELECT id, "dedupeKey", extract(epoch FROM "updatedAt")::text AS "updatedAtToken", "evidenceJson"
    FROM public.ai_monitoring_alerts
    WHERE status = 'OPEN' AND "businessUnit" = 'clothing'
      AND category IN ('ACCOUNTING_MISMATCH', 'INVOICE_OVERDUE')
  `;
}

export async function autoResolveStaleAlertsInStore(
  candidates: ClothingAlertSnapshot[],
  now: Date,
  client: Pick<Prisma.TransactionClient, '$executeRaw'> = prisma
): Promise<number> {
  let count = 0;
  for (const candidate of candidates) {
    count += await client.$executeRaw`
        UPDATE public.ai_monitoring_alerts
        SET status = 'RESOLVED', "resolvedAt" = ${now}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${candidate.id} AND status = 'OPEN' AND "businessUnit" = 'clothing'
          AND "dedupeKey" = ${candidate.dedupeKey}
          AND extract(epoch FROM "updatedAt") = ${candidate.updatedAtToken}::numeric
      `;
  }
  return count;
}
