import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars/dist/handlebars';
import type { TemplateDelegate } from 'handlebars';
import { getChromiumBrowserType } from '@/lib/playwright/chromium';
import type { ScheduledReturn } from '@/lib/investors/schedule';

export const COMPANY_NAME = 'Czarlie & Ron';

const TEMPLATE_PATH = path.join(
  process.cwd(),
  'templates',
  'investor-payout-statement.hbs'
);
const LOGO_PATH = path.join(
  process.cwd(),
  'templates',
  'images',
  'payslip-logo.png'
);
let templateCache: TemplateDelegate | null = null;
let logoCache: string | null = null;

const RETURN_LABELS = {
  deferred: 'Setup deferral',
  waived: 'March waived',
  paid: 'Paid',
  overdue: 'Overdue',
  upcoming: 'Upcoming',
} as const;

type ReturnStatus = keyof typeof RETURN_LABELS;

export type ReturnRow = {
  month: number;
  anniversaryDate: string;
  bankingDate: string;
  amount: number;
  paidDate: string;
  status: string;
  statusClass: string;
  rowClass: string;
};

export type ReturnTotal = { amount: number; count: number };

export type ReturnSummary = {
  paid: ReturnTotal;
  upcoming: ReturnTotal;
  overdue: ReturnTotal;
  total: ReturnTotal;
  progress: number;
};

export type ContractSummary = {
  effectiveDate: string;
  firstPayoutDate: string;
  maturityDate: string;
  repaymentDeadline: string;
  monthlyReturn: number;
  statusLabel: string;
  nextPayout: {
    label: string;
    month: number;
    bankingDate: string;
    amount: number;
    overdue: boolean;
  } | null;
};

/** Fields shared by every page rendered from the statement template. */
export type StatementPageContext = {
  companyName: string;
  logoData: string;
  statementReference: string;
  payoutPeriod: string;
  investorName: string;
  agreementReference: string;
  principal: number;
  monthlyRate: string;
  generatedAt: string;
  contractOnly?: boolean;
  contract?: ContractSummary;
  returnColumns: ReturnRow[][];
  returnSummary: ReturnSummary;
};

export function getStatementTemplate(): TemplateDelegate {
  if (!templateCache) {
    templateCache = Handlebars.compile(
      fs.readFileSync(TEMPLATE_PATH, 'utf8')
    ) as TemplateDelegate;
    Handlebars.registerHelper('currency', (value: number) =>
      new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
      }).format(Number(value) || 0)
    );
  }
  return templateCache;
}

export function getStatementLogo(): string {
  if (logoCache === null) {
    logoCache = fs.existsSync(LOGO_PATH)
      ? fs.readFileSync(LOGO_PATH).toString('base64')
      : '';
  }
  return logoCache;
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Accepts `YYYY-MM` or `YYYY-MM-DD` and returns e.g. "March 2026". */
export function formatMonthYear(date: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`));
}

/** `today` is the local business date (YYYY-MM-DD); `now` supplies the time. */
export function formatGeneratedAt(today: string, now: Date): string {
  const time = now.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  });
  return `${formatDate(today)} · ${time}`;
}

/** Keeps spaces in the investor name, e.g. "Jane Doe-CR-001-statement.pdf". */
export function statementFilename(
  investorName: string,
  reference: string
): string {
  return `${investorName}-${reference}-statement.pdf`.replace(
    /[<>:"/\\|?*\x00-\x1F]/g,
    ''
  );
}

/**
 * Builds the 36-month return table, the two table columns, and the summary
 * tiles. `paidDates` maps agreement month to the recorded payment date.
 * `currentMonth` highlights one row (used by the single-payout statement).
 */
export function buildReturnSchedule(input: {
  payouts: ScheduledReturn[];
  paidDates: Map<number, string>;
  today: string;
  currentMonth?: number;
}): { columns: ReturnRow[][]; summary: ReturnSummary } {
  const rows: ReturnRow[] = input.payouts.map((payout) => {
    const paidDate = input.paidDates.get(payout.month);
    const statusClass: ReturnStatus =
      payout.status !== 'scheduled'
        ? payout.status
        : paidDate
          ? 'paid'
          : payout.dueDate && payout.dueDate < input.today
            ? 'overdue'
            : 'upcoming';
    return {
      month: payout.month,
      anniversaryDate: formatShortDate(payout.anniversaryDate),
      bankingDate: payout.dueDate ? formatShortDate(payout.dueDate) : '—',
      amount: payout.amountCents / 100,
      paidDate: paidDate ? formatShortDate(paidDate) : '—',
      status: RETURN_LABELS[statusClass],
      statusClass,
      rowClass: [
        payout.month === input.currentMonth && 'current',
        payout.status !== 'scheduled' && 'muted',
      ]
        .filter(Boolean)
        .join(' '),
    };
  });
  const totalFor = (selected: ScheduledReturn[]): ReturnTotal => ({
    amount: selected.reduce((sum, payout) => sum + payout.amountCents, 0) / 100,
    count: selected.length,
  });
  const withStatus = (statusClass: string) =>
    input.payouts.filter((_, index) => rows[index].statusClass === statusClass);
  const payable = input.payouts.filter(
    (payout) => payout.status === 'scheduled'
  );
  const paid = totalFor(withStatus('paid'));
  const half = Math.ceil(rows.length / 2);
  return {
    columns: [rows.slice(0, half), rows.slice(half)],
    summary: {
      paid,
      upcoming: totalFor(withStatus('upcoming')),
      overdue: totalFor(withStatus('overdue')),
      total: totalFor(payable),
      progress: payable.length
        ? Math.round((paid.count / payable.length) * 100)
        : 0,
    },
  };
}

/** Renders each HTML document to an A4 PDF using one shared browser. */
export async function renderStatementPdfs(
  documents: string[]
): Promise<Buffer[]> {
  const browserType = await getChromiumBrowserType();
  const browser = await browserType.launch({
    headless: true,
    executablePath: browserType.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await (await browser.newContext()).newPage();
    await page.emulateMedia({ media: 'screen' });
    const buffers: Buffer[] = [];
    for (const html of documents) {
      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      buffers.push(
        Buffer.from(
          await page.pdf({
            format: 'A4',
            preferCSSPageSize: true,
            printBackground: true,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
          })
        )
      );
    }
    return buffers;
  } finally {
    await browser.close();
  }
}
