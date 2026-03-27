export type LedgerEntry = {
  id: string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
  balance?: number;
  sourceType?: string;
  sourceId?: string | null;
  sourceLineKey?: string;
  systemGenerated?: boolean;
  transitBuildShipmentId?: number | null;
  transitBuildEntryIds?: string[];
  transitBuildDebitAccount?: string;
  transitBuildCreditAccount?: string;
};

export type OpeningBalanceEntry = {
  id: string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description?: string;
};

export type LedgerStats = {
  totalDebits: number;
  totalCredits: number;
  netChange: number;
  accounts: number;
  period: string;
};
