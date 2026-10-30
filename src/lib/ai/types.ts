export type AiProviderId = 'ollama' | 'google' | 'openai' | 'copilot';

export type AiBusinessUnit = 'clothing' | 'trucking' | 'general-merchandise';

export type AiAlertCategory =
  | 'INVOICE_OVERDUE'
  | 'ACCOUNTING_MISMATCH'
  | 'INVENTORY_DRIFT'
  | 'RECURRING_PAYMENT_DUE'
  | 'SCHEDULE_ANOMALY';

export type AiAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type AiAlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export type AiTriggerSource =
  | 'USER_CHAT'
  | 'SCHEDULED_BRIEFING'
  | 'ALERT_INVESTIGATION'
  | 'CONNECTION_TEST'
  | 'EVALUATION_TEST';

export interface AiProviderCredentialStatus {
  ollamaConfigured: boolean;
  hasGeminiKey: boolean;
  hasOpenAiKey: boolean;
  hasCopilotToken?: boolean;
}

export interface AiUsageSummary {
  todayInputTokens: number;
  todayOutputTokens: number;
  todayTotalTokens: number;
  monthEstimatedCostUsd: number;
  todayRequestCount: number;
}

export interface AiAssistantConfig {
  id: string;
  key: string;
  activeProvider: AiProviderId;
  activeModel: string;
  accountingModel: string | null;
  ollamaBaseUrl: string;
  fallbackProvider: AiProviderId | null;
  fallbackModel: string | null;
  allowCloudDataSharing: boolean;
  dailyTokenLimit: number;
  monthlyBudgetUsd: number;
  monitoringEnabled: boolean;
  morningBriefingEnabled: boolean;
  morningBriefingTime: string;
  timezone: string;
  updatedAt: string;
  updatedByUserId: string | null;
  credentials: AiProviderCredentialStatus;
  usage: AiUsageSummary;
}

export interface AiToolExecutionContext {
  userId: string | null;
  userRole: string | null;
  accessibleModules: string[];
  allowedBusinessUnits: AiBusinessUnit[];
}

export interface AiToolParameterProperty {
  type: 'string' | 'number' | 'boolean';
  description: string;
  enum?: string[];
}

export interface AiToolDefinition {
  name: string;
  description: string;
  businessUnits: AiBusinessUnit[];
  readOnly: true;
  parameters: {
    type: 'object';
    properties: Record<string, AiToolParameterProperty>;
    required?: string[];
  };
  execute: (
    args: Record<string, unknown>,
    context: AiToolExecutionContext
  ) => Promise<unknown>;
}

export interface AiToolCallTrace {
  toolName: string;
  args: Record<string, unknown>;
  recordCount?: number;
  durationMs: number;
}

export interface AiGenerationResult {
  text: string;
  provider: AiProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  toolsCalled: AiToolCallTrace[];
  usedFallback: boolean;
}

export interface AiConnectionTestResult {
  ok: boolean;
  provider: AiProviderId;
  model: string;
  latencyMs: number;
  message: string;
  discoveredModels: string[];
}

export interface DetectedAnomalyInput {
  dedupeKey: string;
  businessUnit: AiBusinessUnit;
  category: AiAlertCategory;
  severity: AiAlertSeverity;
  title: string;
  deterministicSummary: string;
  sourceLink: string;
  evidenceJson: Record<string, unknown>;
}
