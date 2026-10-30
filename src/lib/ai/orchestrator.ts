import { generateWithProvider, type AiChatHistoryMessage } from './providers';
import { ensureAiAssistantTables, getAiAssistantSettings } from './settings';
import {
  findMonitoringAlertByIdFromStore,
  insertAuditLogToStore,
  updateMonitoringAlertExplanationInStore,
} from './store';
import { assertBusinessUnitAccess, getToolsForContext } from './tools';
import type {
  AiBusinessUnit,
  AiGenerationResult,
  AiProviderId,
  AiToolCallTrace,
  AiToolDefinition,
  AiToolExecutionContext,
  AiTriggerSource,
} from './types';

interface PrefetchedToolRecord {
  toolName: string;
  businessUnit: AiBusinessUnit;
  output: Record<string, unknown>;
}

async function prefetchDeterministicToolData(params: {
  userPrompt: string;
  tools: AiToolDefinition[];
  toolContext: AiToolExecutionContext;
  targetBusinessUnit?: AiBusinessUnit;
}): Promise<{
  records: PrefetchedToolRecord[];
  traces: AiToolCallTrace[];
}> {
  if (!params.tools.length) {
    return { records: [], traces: [] };
  }

  const q = params.userPrompt.toLowerCase();
  const wantRecurring =
    /recurring|loan|rent|utilit|obligation|due this week|upcoming payment|template|draft/i.test(
      q
    );
  const wantOverdue =
    /overdue|invoice|receivable|unpaid|balance|customer|collect|follow-up|follow up|aging|payment/i.test(
      q
    );
  const wantDiscrepancy =
    /discrepanc|mismatch|audit|shortage|accounting|negative|stock|inventory|anomal|error/i.test(
      q
    );
  const wantSchedule =
    /schedule|shift|leave|employee|staff|driver|attendance|absent/i.test(q);

  const anySpecificMatch =
    wantRecurring || wantOverdue || wantDiscrepancy || wantSchedule;

  const selectedTools = params.tools.filter((t) => {
    if (!anySpecificMatch) {
      return true;
    }
    if (
      t.name === 'getUpcomingRecurringObligations' &&
      (wantRecurring || wantOverdue)
    ) {
      return true;
    }
    if (t.name === 'getOverdueInvoicesAndReceivables' && wantOverdue) {
      return true;
    }
    if (t.name === 'getAccountingDiscrepancies' && wantDiscrepancy) {
      return true;
    }
    if (t.name === 'getSchedulesAndEmployeeFollowUps' && wantSchedule) {
      return true;
    }
    return false;
  });

  const targetUnits: AiBusinessUnit[] = params.targetBusinessUnit
    ? [params.targetBusinessUnit]
    : params.toolContext.allowedBusinessUnits;

  const records: PrefetchedToolRecord[] = [];
  const traces: AiToolCallTrace[] = [];

  for (const tool of selectedTools) {
    for (const unit of targetUnits) {
      if (!tool.businessUnits.includes(unit)) {
        continue;
      }
      const start = Date.now();
      try {
        const output = (await tool.execute(
          { businessUnit: unit, limit: 15 },
          params.toolContext
        )) as Record<string, unknown>;
        traces.push({
          toolName: tool.name,
          args: { businessUnit: unit },
          durationMs: Date.now() - start,
        });
        records.push({
          toolName: tool.name,
          businessUnit: unit,
          output,
        });
      } catch {
        // Ignore individual tool failure during prefetch
      }
    }
  }

  return { records, traces };
}

function buildDeterministicFallbackMarkdown(
  records: PrefetchedToolRecord[]
): string {
  const sections: string[] = [
    '### Read-Only Business Audit Summary',
    '_Verified directly from live deterministic PostgreSQL records:_',
    '',
  ];

  for (const rec of records) {
    const unitLabel =
      rec.businessUnit === 'general-merchandise'
        ? 'General Merchandise'
        : rec.businessUnit === 'trucking'
          ? 'Trucking'
          : 'Clothing';

    if (rec.toolName === 'getUpcomingRecurringObligations') {
      const items =
        (rec.output.items as Array<{
          id: string;
          name: string;
          kind: string;
          amount: number;
          frequency: string;
          nextDueDate: string;
          pendingDraftCount: number;
          sourceLink: string;
        }>) ?? [];
      sections.push(`#### ${unitLabel} — Upcoming Recurring Obligations`);
      if (!items.length) {
        sections.push(
          '- No active recurring payment templates or pending drafts found.'
        );
      } else {
        for (const item of items.slice(0, 10)) {
          sections.push(
            `- **${item.name}** (${item.kind}, ${item.frequency}): **₱${Number(item.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}** — Next due: \`${item.nextDueDate}\` (${item.pendingDraftCount} pending draft(s)) · [View Accounting](${item.sourceLink})`
          );
        }
      }
      sections.push('');
    } else if (rec.toolName === 'getOverdueInvoicesAndReceivables') {
      const items = (rec.output.items as Array<Record<string, unknown>>) ?? [];
      sections.push(`#### ${unitLabel} — Overdue Invoices & Receivables`);
      if (!items.length) {
        sections.push('- No overdue invoices or unpaid receivables found.');
      } else {
        for (const item of items.slice(0, 10)) {
          const id = item.invoiceId ?? item.transactionId ?? 'N/A';
          const customer = item.customerName ?? item.customer ?? 'Unknown';
          const bal = Number(
            item.remainingBalance ?? item.lineTotal ?? 0
          ).toLocaleString('en-PH', { minimumFractionDigits: 2 });
          const due = item.dueDate ?? 'No due date';
          sections.push(
            `- **Record #${id}** (${customer}): Balance **₱${bal}** — Status: \`${String(item.status ?? item.orderStatus ?? '')}\` (Due: \`${String(due)}\`)`
          );
        }
      }
      sections.push('');
    } else if (rec.toolName === 'getAccountingDiscrepancies') {
      const anomalies =
        (rec.output.anomalies as Array<Record<string, unknown>>) ?? [];
      sections.push(`#### ${unitLabel} — Accounting Discrepancies`);
      if (!anomalies.length) {
        sections.push(
          '- No payment allocation or line-total discrepancies detected.'
        );
      } else {
        for (const a of anomalies.slice(0, 10)) {
          const id = a.transactionId ?? a.invoiceId ?? 'N/A';
          sections.push(
            `- **Record #${id}** (${String(a.customer ?? '')}): ${String(a.issue ?? '')}`
          );
        }
      }
      sections.push('');
    } else if (rec.toolName === 'getSchedulesAndEmployeeFollowUps') {
      const schedules =
        (rec.output.schedules as Array<Record<string, unknown>>) ?? [];
      const leaves =
        (rec.output.pendingLeaves as Array<Record<string, unknown>>) ?? [];
      sections.push(`#### ${unitLabel} — Employee Schedules & Pending Leaves`);
      sections.push(
        `- **Upcoming Schedules:** ${schedules.length} shift(s) scheduled.`
      );
      for (const s of schedules.slice(0, 5)) {
        sections.push(
          `  - **${String(s.employeeName)}**: \`${String(s.date)}\` (${String(s.shiftType)}, ${String(s.startTime)}–${String(s.endTime)})`
        );
      }
      sections.push(
        `- **Pending Leave Requests:** ${leaves.length} awaiting review.`
      );
      for (const l of leaves.slice(0, 5)) {
        sections.push(
          `  - **${String(l.employeeName)}**: ${String(l.leaveType)} (\`${String(l.startDate)}\` to \`${String(l.endDate)}\`)`
        );
      }
      sections.push('');
    }
  }

  return sections.join('\n').trim();
}

const SYSTEM_PROMPT = `You are a strictly READ-ONLY AI Business Auditor and Operations Assistant for a multi-business LAN management platform (Clothing Wholesale, Trucking/Logistics, and General Merchandise).

NON-NEGOTIABLE RULES:
1. You have READ-ONLY access via predefined tools. You cannot create, modify, or delete any transactions, invoices, payments, ledger entries, or inventory records.
2. Never invent or guess arithmetic balances. Always rely on the deterministic numbers provided by the backend tools or evidence payload.
3. Always cite exact record IDs (e.g., Transaction #1042, Trucking Invoice ID, Product Code) and link the user to the relevant module path.
4. Keep records strictly separated between Clothing, Trucking, and General Merchandise.
5. Recommend clear manual verification steps or draft follow-up messages for human approval.`;

export interface RunBusinessAiParams {
  userPrompt: string;
  /** Prior chat turns for multi-turn conversations (oldest first). */
  history?: AiChatHistoryMessage[];
  triggerSource: AiTriggerSource;
  toolContext: AiToolExecutionContext;
  userId?: string | null;
  userName?: string | null;
  businessUnit?: AiBusinessUnit;
  useAccountingModel?: boolean;
  enableTools?: boolean;
  isSyntheticTest?: boolean;
  providerOverride?: AiProviderId;
  modelOverride?: string;
}

export async function runBusinessAiAssistant(
  params: RunBusinessAiParams
): Promise<AiGenerationResult> {
  const settings = await getAiAssistantSettings();
  const primaryProvider = params.providerOverride ?? settings.activeProvider;
  const primaryModel =
    params.modelOverride ||
    (params.useAccountingModel && settings.accountingModel
      ? settings.accountingModel
      : settings.activeModel);

  if (params.businessUnit) {
    assertBusinessUnitAccess(params.toolContext, params.businessUnit);
  }

  // Enforce Cloud Data Sharing policy for any non-synthetic request
  if (
    !params.isSyntheticTest &&
    primaryProvider !== 'ollama' &&
    !settings.allowCloudDataSharing
  ) {
    throw new Error(
      `Cloud Data Sharing is disabled in AI Assistant Settings. Enable "Allow Cloud Data Sharing" before sending business data to ${primaryProvider}, or switch Active Provider to local Ollama.`
    );
  }

  // Enforce daily token and monthly budget limits
  if (
    settings.usage.todayTotalTokens >= settings.dailyTokenLimit &&
    !params.isSyntheticTest
  ) {
    throw new Error(
      `Daily AI token limit (${settings.dailyTokenLimit.toLocaleString()} tokens) has been reached. Adjust the limit in Settings > AI Assistant.`
    );
  }

  if (
    primaryProvider !== 'ollama' &&
    settings.usage.monthEstimatedCostUsd >= settings.monthlyBudgetUsd &&
    !params.isSyntheticTest
  ) {
    throw new Error(
      `Monthly cloud AI budget ($${settings.monthlyBudgetUsd.toFixed(2)}) has been reached. Switch to local Ollama or increase the monthly budget.`
    );
  }

  const tools =
    params.enableTools !== false
      ? getToolsForContext(params.toolContext, params.businessUnit)
      : [];

  // Pre-execute deterministic read-only PostgreSQL tools so cloud LLMs only need 1 single round-trip instead of 2+
  const prefetched = await prefetchDeterministicToolData({
    userPrompt: params.userPrompt,
    tools,
    toolContext: params.toolContext,
    targetBusinessUnit: params.businessUnit,
  });

  const effectiveUserPrompt =
    prefetched.records.length > 0
      ? [
          params.userPrompt,
          '',
          'DETERMINISTIC READ-ONLY DATABASE SNAPSHOT (already verified from PostgreSQL — answer directly using these exact figures without calling tools):',
          JSON.stringify(prefetched.records),
        ].join('\n')
      : params.userPrompt;

  const effectiveTools = prefetched.records.length > 0 ? [] : tools;

  let result: Omit<AiGenerationResult, 'usedFallback'>;
  let usedFallback = false;

  try {
    const gen = await generateWithProvider({
      provider: primaryProvider,
      model: primaryModel,
      ollamaBaseUrl: settings.ollamaBaseUrl,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: effectiveUserPrompt,
      history: params.history,
      tools: effectiveTools,
      toolContext: params.toolContext,
      timeoutMs: prefetched.records.length > 0 ? 8000 : 45000,
    });
    result = {
      ...gen,
      toolsCalled: [...prefetched.traces, ...gen.toolsCalled],
    };
  } catch (primaryError) {
    const canFallback =
      Boolean(settings.fallbackProvider && settings.fallbackModel) &&
      !params.providerOverride &&
      (settings.fallbackProvider === 'ollama' ||
        settings.allowCloudDataSharing ||
        Boolean(params.isSyntheticTest));

    if (canFallback && settings.fallbackProvider && settings.fallbackModel) {
      try {
        const fallbackGen = await generateWithProvider({
          provider: settings.fallbackProvider,
          model: settings.fallbackModel,
          ollamaBaseUrl: settings.ollamaBaseUrl,
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: effectiveUserPrompt,
          history: params.history,
          tools: effectiveTools,
          toolContext: params.toolContext,
          timeoutMs: 45000,
        });
        result = {
          ...fallbackGen,
          toolsCalled: [...prefetched.traces, ...fallbackGen.toolsCalled],
        };
        usedFallback = true;
      } catch {
        if (prefetched.records.length > 0) {
          result = {
            text: buildDeterministicFallbackMarkdown(prefetched.records),
            provider: primaryProvider,
            model: `${primaryModel} (deterministic-fallback)`,
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: 0,
            latencyMs: prefetched.traces.reduce(
              (sum, t) => sum + t.durationMs,
              0
            ),
            toolsCalled: prefetched.traces,
          };
          usedFallback = true;
        } else {
          throw primaryError;
        }
      }
    } else if (prefetched.records.length > 0) {
      result = {
        text: buildDeterministicFallbackMarkdown(prefetched.records),
        provider: primaryProvider,
        model: `${primaryModel} (deterministic-fallback)`,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        latencyMs: prefetched.traces.reduce((sum, t) => sum + t.durationMs, 0),
        toolsCalled: prefetched.traces,
      };
      usedFallback = true;
    } else {
      await insertAuditLogToStore({
        userId: params.userId ?? null,
        userName: params.userName ?? null,
        triggerSource: params.triggerSource,
        businessUnit: params.businessUnit ?? null,
        provider: primaryProvider,
        model: primaryModel,
        status: 'ERROR',
        errorMessage:
          primaryError instanceof Error
            ? primaryError.message.slice(0, 950)
            : 'AI provider request failed',
      });
      throw primaryError;
    }
  }

  await insertAuditLogToStore({
    userId: params.userId ?? null,
    userName: params.userName ?? null,
    triggerSource: params.triggerSource,
    businessUnit: params.businessUnit ?? null,
    provider: result.provider,
    model: result.model,
    toolsCalled: result.toolsCalled,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    estimatedCostUsd: result.estimatedCostUsd,
    latencyMs: result.latencyMs,
    status: 'SUCCESS',
    metadata: { usedFallback },
  });

  return {
    ...result,
    usedFallback,
  };
}

export async function explainMonitoringAlertWithAi(params: {
  alertId: string;
  toolContext: AiToolExecutionContext;
  userId?: string | null;
  userName?: string | null;
}) {
  await ensureAiAssistantTables();
  const alert = await findMonitoringAlertByIdFromStore(params.alertId);

  if (!alert) {
    throw new Error('Alert not found.');
  }

  assertBusinessUnitAccess(
    params.toolContext,
    alert.businessUnit as AiBusinessUnit
  );

  const prompt = [
    `Analyze this deterministic monitoring alert for the "${alert.businessUnit}" business unit:`,
    `- Category: ${alert.category}`,
    `- Severity: ${alert.severity}`,
    `- Title: ${alert.title}`,
    `- Deterministic Summary: ${alert.deterministicSummary}`,
    `- Source Module Link: ${alert.sourceLink ?? 'N/A'}`,
    `- Bounded Evidence JSON: ${JSON.stringify(alert.evidenceJson ?? {})}`,
    '',
    'Provide:',
    '1. Plain-language explanation of the discrepancy or overdue item citing the exact record IDs and amounts.',
    '2. Likely operational or bookkeeping causes (without guessing arithmetic).',
    '3. Recommended manual verification steps (and a short polite follow-up reminder draft if customer-facing).',
  ].join('\n');

  const aiResult = await runBusinessAiAssistant({
    userPrompt: prompt,
    triggerSource: 'ALERT_INVESTIGATION',
    toolContext: params.toolContext,
    userId: params.userId,
    userName: params.userName,
    businessUnit: alert.businessUnit as AiBusinessUnit,
    useAccountingModel: alert.category === 'ACCOUNTING_MISMATCH',
    enableTools: false,
  });

  const updated = await updateMonitoringAlertExplanationInStore(
    alert.id,
    aiResult.text,
    `${aiResult.provider}:${aiResult.model}`
  );

  return {
    alert: updated,
    generation: aiResult,
  };
}

export async function runSyntheticInvestigationTest(params: {
  toolContext: AiToolExecutionContext;
  userId?: string | null;
  userName?: string | null;
  providerOverride?: AiProviderId;
  modelOverride?: string;
}): Promise<AiGenerationResult> {
  const syntheticPrompt = [
    'SYNTHETIC AUDIT BENCHMARK (No real customer data):',
    '- Business Unit: Clothing Wholesale',
    '- Opening Cash (Deterministic): ₱100,000.00',
    '- Recorded Cash Received: ₱25,000.00 (Orders #9001, #9002)',
    '- Recorded Cash Expenses: ₱30,000.00 (Supplier Freight #401)',
    '- Expected Closing Cash (Deterministic): ₱95,000.00',
    '- Actual Counted Closing Cash: ₱93,000.00',
    '- Deterministic Discrepancy Flagged: -₱2,000.00 shortage',
    '- Supporting Anomaly: Order #9002 (Total ₱10,000.00) is marked PAID, but recorded TransactionPayment rows sum to ₱8,000.00.',
    '',
    'Explain the ₱2,000.00 discrepancy, cite Order #9002, and list the exact read-only verification steps for the bookkeeper without modifying any records.',
  ].join('\n');

  return runBusinessAiAssistant({
    userPrompt: syntheticPrompt,
    triggerSource: 'EVALUATION_TEST',
    toolContext: params.toolContext,
    userId: params.userId,
    userName: params.userName,
    useAccountingModel: true,
    enableTools: false,
    isSyntheticTest: true,
    providerOverride: params.providerOverride,
    modelOverride: params.modelOverride,
  });
}
