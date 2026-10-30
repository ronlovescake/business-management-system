import type { AiBusinessUnit } from './types';

export interface PrefetchedToolRecord {
  toolName: string;
  businessUnit: AiBusinessUnit;
  output: Record<string, unknown>;
}

export function buildDeterministicFallbackMarkdown(
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
          const customer = item.customerName ?? item.customer ?? 'Unknown';
          const bal = Number(
            item.remainingBalance ?? item.lineTotal ?? 0
          ).toLocaleString('en-PH', { minimumFractionDigits: 2 });
          const due = item.dueDate ?? item.dueAt ?? 'No automatic due date';
          sections.push(
            `- **${customer}**: Balance **₱${bal}** — Status: \`${String(item.status ?? item.orderStatus ?? '')}\` (Due: \`${String(due)}\`)`
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
          sections.push(
            `- **${String(a.customer ?? 'Accounting discrepancy')}**: ${String(a.issue ?? '')}`
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
          sections.push(
            `- **${String(c.topic)}**: ${String(c.rule)} (Source: ${String(c.id ?? '')}; ${String(c.sourceDoc ?? '')})`
          );
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
