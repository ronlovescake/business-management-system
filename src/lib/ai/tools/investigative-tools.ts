import type { AiToolDefinition } from '../types';
import { CASH_RECONCILIATION_TOOL } from './cash-reconciliation-tool';
import { CUSTOMER_HISTORY_TOOL } from './customer-history-tool';
import { DATABASE_READ_ONLY_TOOL } from './database-read-only-tool';
import { KNOWLEDGE_BASE_TOOL } from './knowledge-base-tool';
import { CUSTOMER_ADDRESS_TOOL } from './customer-address-tool';
import { CUSTOMER_DUPLICATE_AUDIT_TOOL } from './customer-duplicate-audit-tool';

export { validateAndBoundReadOnlySql } from './database-read-only-tool';
export { KNOWLEDGE_BASE_TOOL } from './knowledge-base-tool';

export const INVESTIGATIVE_BUSINESS_TOOLS: readonly AiToolDefinition[] = [
  CASH_RECONCILIATION_TOOL,
  CUSTOMER_HISTORY_TOOL,
  DATABASE_READ_ONLY_TOOL,
  KNOWLEDGE_BASE_TOOL,
  CUSTOMER_ADDRESS_TOOL,
  CUSTOMER_DUPLICATE_AUDIT_TOOL,
];
