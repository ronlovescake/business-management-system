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
  const wantKnowledge =
    /policy|handbook|sop|procedure|what to do|what should|how to|rule|template|grace period|cancell|forfeit|penalty|guide/i.test(
      q
    );

  const anySpecificMatch =
    wantRecurring ||
    wantOverdue ||
    wantDiscrepancy ||
    wantSchedule ||
    wantKnowledge;

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
    if (t.name === 'searchKnowledgeBaseAndSOPs' && wantKnowledge) {
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
        const toolArgs =
          tool.name === 'searchKnowledgeBaseAndSOPs'
            ? { query: params.userPrompt, businessUnit: unit }
            : { businessUnit: unit, limit: 15 };
        const output = (await tool.execute(
          toolArgs,
          params.toolContext
        )) as Record<string, unknown>;
        traces.push({
          toolName: tool.name,
          args: toolArgs,
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
    } else if (rec.toolName === 'searchKnowledgeBaseAndSOPs') {
      const core =
        (rec.output.corePolicies as Array<Record<string, unknown>>) ?? [];
      const tpls =
        (rec.output.preApprovedMessageTemplates as Array<
          Record<string, unknown>
        >) ?? [];
      const procs =
        (rec.output.handbookProcedures as Array<Record<string, unknown>>) ?? [];
      sections.push(
        `#### ${unitLabel} — Official Policies, SOPs & Message Templates`
      );
      if (core.length) {
        sections.push('**Standard Operating Procedures:**');
        for (const c of core) {
          sections.push(`- **${String(c.topic)}**: ${String(c.rule)}`);
        }
        sections.push('');
      }
      if (tpls.length) {
        sections.push('**Pre-Approved Message Templates:**');
        for (const t of tpls) {
          sections.push(
            `- **${String(t.title)}** (\`${String(t.badge)}\`):\n\`\`\`text\n${String(t.bodyText ?? '')}\n\`\`\``
          );
        }
        sections.push('');
      }
      if (procs.length) {
        sections.push('**Handbook Procedures:**');
        for (const p of procs) {
          sections.push(
            `- [${String(p.title)}](${String(p.handbookLink)}): ${String(p.summary)}`
          );
        }
        sections.push('');
      }
    }
  }

  return sections.join('\n').trim();
}

const SYSTEM_PROMPT = `You are a sharp, conversational, strictly READ-ONLY AI Financial Controller and Operations Partner for a multi-business LAN management platform (Clothing Wholesale, Trucking/Logistics, and General Merchandise).

CONVERSATIONAL & INVESTIGATIVE STYLE:
- Speak naturally, warmly, and directly like an experienced human business partner—never sound like a rigid FAQ bot or dump unrelated audit sections when the user asks a specific question.
- Answer the exact question the user asked. If they ask an open-ended question (e.g., "Who is our oldest customer?", "What did Shanna Lim order?", "How much did we spend on freight?"), call the appropriate read-only database tool (\`queryCustomersAndOrderHistory\` or \`queryDatabaseReadOnly\`) to check the live PostgreSQL database before answering.
- If the user states their current cash/bank balance or asks whether cash matches the records (e.g., "Our cash right now is 100,000.00. Can you check if it matches all the records and if not, please find why"), call \`reconcileCashAndFindDiscrepancies\` with \`actualCashAmount\` set to their stated number. Walk them through:
  1. What the recorded book cash balance is (and its breakdown: opening balance, customer payments, paid expenses, refunds, manual journal lines).
  2. Whether it matches, and the exact peso variance (surplus or shortage).
  3. The exact culprit records discovered in the database that explain the difference (such as duplicate customer payments on the same order, overpaid orders with negative lineTotal, unposted recurring loan/expense drafts, pending cancellation refund payouts, or approved-but-unpaid expenses).

KNOWLEDGE BASE, EMPLOYEE HANDBOOK & POLICY GUIDANCE:
- For Clothing procedural or policy questions, use \`searchKnowledgeBaseAndSOPs\` to retrieve Clothing SOPs, handbook procedures, due-date policies, and pre-approved message templates rather than guessing.
- Cite the returned source policies and module links. Follow their stated review and approval requirements; do not infer automatic cancellation, forfeiture, or refund entitlement.
- This knowledge base contains Clothing policies only. Never apply them to Trucking or General Merchandise. If no approved policy is available for the requested domain, state that limitation and request the relevant policy from its owner.

NON-NEGOTIABLE SAFETY RULES:
1. You have strictly READ-ONLY access via predefined tools. You cannot create, modify, or delete any transactions, invoices, payments, ledger entries, or inventory records.
2. Never invent or guess arithmetic balances. Always rely on the deterministic numbers returned by the read-only tools.
3. Always cite exact record IDs (e.g., Order #3395, Payment #1617, Customer ID, Product Code) and link the user to the relevant module path.
4. Keep records strictly separated between Clothing, Trucking, and General Merchandise. Unless the user specifies otherwise, default to Clothing (or the active businessUnit filter).
5. Respond to standalone greetings briefly and naturally (for example, "Good morning! How can I help you check the books or operations today?"). Do not volunteer business records or an audit summary on a greeting.`;

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

  const isStandaloneGreeting =
    params.triggerSource === 'USER_CHAT' &&
    /^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening))[\s!.?]*$/i.test(
      params.userPrompt.trim()
    );

  const tools =
    params.enableTools !== false && !isStandaloneGreeting
      ? getToolsForContext(params.toolContext, params.businessUnit)
      : [];

  let result: Omit<AiGenerationResult, 'usedFallback'>;
  let usedFallback = false;

  try {
    const gen = await generateWithProvider({
      provider: primaryProvider,
      model: primaryModel,
      ollamaBaseUrl: settings.ollamaBaseUrl,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: params.userPrompt,
      history: params.history,
      tools,
      isSyntheticTest: params.isSyntheticTest,
      toolContext: params.toolContext,
      timeoutMs: 45000,
    });
    result = gen;
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
          userPrompt: params.userPrompt,
          history: params.history,
          tools,
          isSyntheticTest: params.isSyntheticTest,
          toolContext: params.toolContext,
          timeoutMs: 45000,
        });
        result = fallbackGen;
        usedFallback = true;
      } catch {
        const prefetched = await prefetchDeterministicToolData({
          userPrompt: params.userPrompt,
          tools,
          toolContext: params.toolContext,
          targetBusinessUnit: params.businessUnit,
        });
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
    } else {
      const prefetched = await prefetchDeterministicToolData({
        userPrompt: params.userPrompt,
        tools,
        toolContext: params.toolContext,
        targetBusinessUnit: params.businessUnit,
      });
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
