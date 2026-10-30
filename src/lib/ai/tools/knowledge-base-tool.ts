import type { AiToolDefinition } from '../types';
import {
  normalizeBusinessUnitArg,
  assertBusinessUnitAccessLocal,
} from './investigative-access';
import { loadHandbook } from '@/modules/clothing/operations/handbook/loadHandbook.server';
import { DEFAULT_MESSAGE_TEMPLATES } from '@/modules/clothing/operations/message-templates/templates.data';
import type { HandbookProcedure } from '@/modules/clothing/operations/handbook/handbook';

interface PolicySnippet {
  id: string;
  topic: string;
  rule: string;
  sourceDoc: string;
}

export function isDirectKnowledgeQuestion(question: string): boolean {
  const normalized = question
    .toLowerCase()
    .replace(/[?.!]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [
    'what should i do if the customer did not pay their order on time',
    'what to do if customer did not pay on time',
    'when should i use the cancellation, forfeited, and voided',
    'what is the process to refund the buyer',
    'what is our cancellation policy',
    'what is our refund policy',
    'how do due dates work',
    'when is an unpaid invoice due',
  ].includes(normalized);
}

// In-memory cache for loaded documents
let cachedHandbook: HandbookProcedure[] | null = null;

async function getHandbookProcedures(): Promise<HandbookProcedure[]> {
  if (!cachedHandbook) {
    try {
      cachedHandbook = await loadHandbook();
    } catch {
      cachedHandbook = [];
    }
  }
  return cachedHandbook;
}

/**
 * Curated core operational rules from docs/business-logic/clothing/operations-workflow.md
 * and operations-due-dates.md for immediate, deterministic guidance.
 */
const CANONICAL_CORE_POLICIES: PolicySnippet[] = [
  {
    id: 'POL-DUE-01',
    topic: 'Due Date Calculation & Cutoff',
    rule: 'Unpaid Prepared invoices are due at 11:59 PM Asia/Manila on the third calendar day after the invoice date (e.g. an October 26 invoice is due October 29 at 11:59 PM Manila, not 72 hours from a button click). This rule does not apply to trusted-customer Accounts Receivable: A/R has no automatic deadline and follow-up is at owner discretion. Late or revised Prepared invoices require administrator review before setting new deadlines.',
    sourceDoc:
      'docs/business-logic/clothing/operations-workflow.md & operations-due-dates.md (F04)',
  },
  {
    id: 'POL-DUE-02',
    topic: 'Overdue Invoice Handling & Cancellation',
    rule: 'Cancellation is NEVER automatic. The Due Dates board is a review aid. Orders that pass their due date remain for manual review. Only an Administrator has the authority to approve cancellation and financial refund/forfeiture decisions.',
    sourceDoc: 'docs/business-logic/clothing/operations-workflow.md (F05)',
  },
  {
    id: 'POL-DUE-03',
    topic: 'Fully Paid Orders Awaiting Pickup',
    rule: 'Fully paid orders awaiting checkout or pickup are NOT payment-overdue and must never be canceled for payment overdue. Delayed pickup alone does not make an order overdue.',
    sourceDoc:
      'docs/business-logic/clothing/operations-workflow.md (Section 3.3, E17)',
  },
  {
    id: 'POL-CAN-01',
    topic:
      'Cancellation with Money Collected (Reservation Deposit vs Installments)',
    rule: 'When a customer cancels with funds collected: the entire initial required Reservation Deposit (10% or 20%) is retained/forfeited. Any additional installments paid beyond the initial deposit are NOT automatically forfeited and may be refunded upon administrator review and approval. Emergency medical requests may receive discretionary full refunds upon explicit owner approval.',
    sourceDoc:
      'docs/business-logic/clothing/operations-workflow.md (Section 3.3, E13)',
  },
  {
    id: 'POL-CAN-02',
    topic: 'Seven-Day Collection & Discretionary Refund Window',
    rule: 'For fully paid orders, customers have a 7-calendar-day window to arrange pickup/checkout starting once goods are physically on hand, Prepared, and the customer has been sent the notice. Requests within the 7-day window may be considered; after 7 days, ordinary cancellations are closed unless an explicit owner exception is granted.',
    sourceDoc:
      'docs/business-logic/clothing/operations-workflow.md (Section 3.3)',
  },
  {
    id: 'POL-SOP-01',
    topic: 'Step-by-Step SOP When Customer Did Not Pay On Time',
    rule: '1. Open Due Dates board (/clothing/operations/due-dates).\n2. Locate customer and verify their due date (11:59 PM Manila on the 3rd calendar day after invoice).\n3. Click "Contact Buyer" to open their Facebook Messenger thread.\n4. Copy and send the official "Payment Reminders" message template.\n5. If the customer still does not settle after the cutoff and follow-up, escalate the order to an Administrator for manual cancellation.\n6. Upon cancellation, retain the agreed initial Reservation Deposit; additional installments require administrator refund review.',
    sourceDoc:
      'docs/business-logic/clothing/operations-handbook.md & operations-message-templates.md',
  },
];

export const KNOWLEDGE_BASE_TOOL: AiToolDefinition = {
  name: 'searchKnowledgeBaseAndSOPs',
  description:
    'Read-only Clothing knowledge base tool that searches official Clothing SOPs, Employee Handbook rules, Due Date & Overdue policies, Cancellation/Refund rules, pre-approved Message Templates, and Accounting guidelines. Call this tool for Clothing procedural or policy questions. These policies must not be applied to Trucking or General Merchandise.',
  businessUnits: ['clothing'],
  readOnly: true,
  parameters: {
    type: 'object',
    properties: {
      businessUnit: {
        type: 'string',
        description: 'Business domain to query (defaults to clothing)',
        enum: ['clothing'],
      },
      query: {
        type: 'string',
        description:
          'Keywords or question, e.g. "customer didn\'t pay on time", "overdue deadline", "cancellation deposit", "payment reminder template", "grace period", "refund policy".',
      },
      category: {
        type: 'string',
        description:
          'Optional category filter to narrow results: "all", "due_dates_and_overdue", "message_templates", "cancellation_and_refunds", "handbook", "accounting".',
        enum: [
          'all',
          'due_dates_and_overdue',
          'message_templates',
          'cancellation_and_refunds',
          'handbook',
          'accounting',
        ],
      },
    },
    required: ['query'],
  },
  execute: async (args, context) => {
    const unit = normalizeBusinessUnitArg(args.businessUnit);
    assertBusinessUnitAccessLocal(context, unit);
    if (unit !== 'clothing') {
      throw new Error('The knowledge base is available only for clothing.');
    }

    const rawQuery = typeof args.query === 'string' ? args.query.trim() : '';
    const category = typeof args.category === 'string' ? args.category : 'all';
    const queryLower = rawQuery.toLowerCase();

    // Identify semantic intents
    const isLateOrOverdueIntent =
      /pay|due|overdue|late|unpaid|deadline|time|expire|delay/i.test(
        queryLower
      );
    const isCancelOrRefundIntent =
      /cancel|refund|deposit|forfeit|void|return|money back/i.test(queryLower);
    const isTemplateIntent =
      /template|message|text|remind|sms|chat|send|say|contact|facebook|fb/i.test(
        queryLower
      );

    const stopWords = new Set([
      'what',
      'when',
      'where',
      'which',
      'who',
      'whom',
      'this',
      'that',
      'these',
      'those',
      'have',
      'from',
      'with',
      'about',
      'into',
      'through',
      'after',
      'before',
      'under',
      'again',
      'there',
      'their',
      'then',
      'once',
      'here',
      'does',
      'just',
      'more',
      'some',
      'such',
      'than',
      'will',
      'very',
      'should',
    ]);
    const queryTerms = queryLower
      .split(/[^a-z0-9-]+/)
      .filter((t) => t.length > 2 && !stopWords.has(t));

    // 1. Search Canonical Core Policies (Scored)
    const scoredCorePolicies = CANONICAL_CORE_POLICIES.map((p) => {
      let score = 0;
      if (
        category === 'due_dates_and_overdue' &&
        (p.id.includes('DUE') || p.id === 'POL-SOP-01')
      ) {
        score += 20;
      } else if (
        category === 'cancellation_and_refunds' &&
        p.id.includes('CAN')
      ) {
        score += 20;
      }

      if (
        isLateOrOverdueIntent &&
        (p.id.includes('DUE') || p.id === 'POL-SOP-01')
      ) {
        score += 15;
      }
      if (isCancelOrRefundIntent && p.id.includes('CAN')) {
        score += 15;
      }
      for (const term of queryTerms) {
        if (p.topic.toLowerCase().includes(term)) {
          score += 6;
        }
        if (p.rule.toLowerCase().includes(term)) {
          score += 2;
        }
      }
      return { policy: p, score };
    })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.policy);

    // 2. Pre-Approved Message Templates (Ranked)
    const scoredTemplates = DEFAULT_MESSAGE_TEMPLATES.map((tpl) => {
      let score = 0;
      const tplCombined =
        `${tpl.id} ${tpl.title} ${tpl.badge} ${tpl.paragraphs.join(' ')}`.toLowerCase();

      if (isLateOrOverdueIntent && tpl.id === 'payment-reminders') {
        score += 25;
      }
      if (isCancelOrRefundIntent && tpl.id.startsWith('cancellation-')) {
        score += 20;
      }
      if (isTemplateIntent) {
        score += 10;
      }

      for (const term of queryTerms) {
        if (tpl.title.toLowerCase().includes(term)) {
          score += 8;
        }
        if (tplCombined.includes(term)) {
          score += 2;
        }
      }

      return { tpl, score };
    })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => ({
        id: item.tpl.id,
        title: item.tpl.title,
        badge: item.tpl.badge,
        paragraphs: item.tpl.paragraphs,
        bodyText: item.tpl.paragraphs.join('\n\n'),
      }));

    // 3. Handbook Procedures (Scored by relevance to SOP)
    const procedures = await getHandbookProcedures();
    const scoredProcedures = procedures
      .map((proc) => {
        let score = 0;

        // High-value SOP anchors
        if (isLateOrOverdueIntent) {
          if (proc.id === 'F04') {
            score += 25; // "When Is An Unpaid Prepared Invoice Due?"
          }
          if (proc.id === 'F05') {
            score += 25; // "Does The App Cancel Or Forfeit Automatically?"
          }
          if (proc.id === 'E17') {
            score += 18; // "A Paid Order Is Still Awaiting Pickup Or An A/R Payment Is Early"
          }
          if (proc.modules.includes('due-dates')) {
            score += 8;
          }
        }

        if (isCancelOrRefundIntent) {
          if (proc.id === 'E13') {
            score += 25; // "A Customer Cancels With Money Already Collected"
          }
          if (proc.id === 'F06') {
            score += 20; // "What Is The Difference Between Cancelled And Voided?"
          }
          if (proc.modules.includes('transactions')) {
            score += 5;
          }
        }

        for (const term of queryTerms) {
          if (proc.id.toLowerCase() === term) {
            score += 20;
          }
          if (proc.title.toLowerCase().includes(term)) {
            score += 10;
          }
          if (proc.modules.some((m: string) => m.includes(term))) {
            score += 4;
          }
          if (proc.searchText.includes(term)) {
            score += 1;
          }
        }

        return { proc, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((item) => {
        const cleanSummary = item.proc.searchText
          .replace(/\s+/g, ' ')
          .replace(/f\d{2}\s+|e\d{2}\s+|s\d{2}\s+|a\d{2}\s+/gi, '')
          .trim();
        return {
          id: item.proc.id,
          title: item.proc.title,
          kind: item.proc.kind,
          modules: item.proc.modules,
          summary:
            cleanSummary.length > 300
              ? `${cleanSummary.slice(0, 300)}...`
              : cleanSummary,
          handbookLink: `/clothing/operations/handbook#${item.proc.id}`,
        };
      });

    // 4. Relevant Module Links
    const recommendedModuleLinks = [
      { label: 'Due Dates Board', path: '/clothing/operations/due-dates' },
      { label: 'Employee Handbook', path: '/clothing/operations/handbook' },
      {
        label: 'Message Templates',
        path: '/clothing/operations/message-templates',
      },
      { label: 'Transactions', path: '/clothing/operations/transactions' },
    ];

    return {
      businessUnit: unit,
      searchQuery: rawQuery,
      corePolicies: scoredCorePolicies.slice(0, 3),
      preApprovedMessageTemplates: scoredTemplates,
      handbookProcedures: scoredProcedures,
      recommendedModuleLinks,
    };
  },
};
