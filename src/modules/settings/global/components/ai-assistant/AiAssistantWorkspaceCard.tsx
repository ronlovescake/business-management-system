'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  Code,
  Divider,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconMessageChatbot,
  IconRadar,
  IconSparkles,
  IconSun,
} from '@tabler/icons-react';
import type { AiBusinessUnit, AiGenerationResult } from '@/lib/ai/types';

interface MonitoringAlertItem {
  id: string;
  dedupeKey: string;
  businessUnit: AiBusinessUnit;
  category: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  title: string;
  deterministicSummary: string;
  aiExplanation: string | null;
  aiModelUsed: string | null;
  sourceLink: string | null;
  evidenceJson?: Record<string, unknown> | null;
  lastDetectedAt: string;
}

function formatSingleAlertForCopy(alert: MonitoringAlertItem): string {
  const lines = [
    `[${alert.severity}] [${alert.businessUnit.toUpperCase()}] [${alert.category}] ${alert.title}`,
    `Summary: ${alert.deterministicSummary}`,
  ];
  if (alert.sourceLink) {
    lines.push(`Source Path: ${alert.sourceLink}`);
  }
  if (alert.evidenceJson && Object.keys(alert.evidenceJson).length > 0) {
    lines.push(`Evidence JSON: ${JSON.stringify(alert.evidenceJson)}`);
  }
  if (alert.aiExplanation) {
    lines.push(`AI Explanation: ${alert.aiExplanation}`);
  }
  return lines.join('\n');
}

function formatAllAlertsForCopy(
  alerts: MonitoringAlertItem[],
  unitFilter: string,
  statusFilter: string
): string {
  const header = [
    `# Deterministic Monitoring & Anomaly Report`,
    `- Scope: ${unitFilter}`,
    `- Status Filter: ${statusFilter}`,
    `- Total Alerts: ${alerts.length}`,
    `- Exported At: ${new Date().toISOString()}`,
    '',
  ];
  const body = alerts.map(
    (alert, idx) => `${idx + 1}. ${formatSingleAlertForCopy(alert)}`
  );
  return [...header, ...body].join('\n\n');
}

export function AiAssistantWorkspaceCard() {
  const [alerts, setAlerts] = useState<MonitoringAlertItem[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [runningScan, setRunningScan] = useState(false);
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [generatingBriefing, setGeneratingBriefing] = useState(false);
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [briefingNotice, setBriefingNotice] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [askingAi, setAskingAi] = useState(false);
  const [chatResult, setChatResult] = useState<AiGenerationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch {
      // Fallback for non-HTTPS local LAN origins if navigator.clipboard is restricted
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    }
  };

  const fetchAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const params = new URLSearchParams();
      if (unitFilter !== 'ALL') {
        params.set('businessUnit', unitFilter);
      }
      params.set('status', statusFilter);
      const res = await fetch(`/api/ai-assistant/alerts?${params.toString()}`);
      const data = (await res.json()) as {
        alerts?: MonitoringAlertItem[];
        error?: string;
      };
      if (res.ok && data.alerts) {
        setAlerts(data.alerts);
      }
    } catch {
      // Keep current alerts on transient network error
    } finally {
      setLoadingAlerts(false);
    }
  }, [unitFilter, statusFilter]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  const handleRunMonitorNow = async () => {
    setRunningScan(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai-assistant/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run-monitor' }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to run deterministic scan');
      }
      await fetchAlerts();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setRunningScan(false);
    }
  };

  const handleExplainAlert = async (alertId: string) => {
    setExplainingId(alertId);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai-assistant/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'explain', alertId }),
      });
      const data = (await res.json()) as {
        alert?: MonitoringAlertItem;
        error?: string;
      };
      if (!res.ok || !data.alert) {
        throw new Error(data.error || 'Failed to explain alert with AI');
      }
      const updatedAlert = data.alert;
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? updatedAlert : a))
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AI explanation failed');
    } finally {
      setExplainingId(null);
    }
  };

  const handleUpdateAlertStatus = async (
    alertId: string,
    action: 'acknowledge' | 'resolve'
  ) => {
    try {
      const res = await fetch('/api/ai-assistant/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, alertId }),
      });
      if (res.ok) {
        await fetchAlerts();
      }
    } catch {
      // Ignore
    }
  };

  const handleGenerateBriefing = async () => {
    setGeneratingBriefing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'briefing',
          ...(unitFilter !== 'ALL' ? { businessUnit: unitFilter } : {}),
        }),
      });
      const data = (await res.json()) as {
        briefing?: string;
        deterministicFallback?: boolean;
        fallbackReason?: string;
        error?: string;
      };
      if (!res.ok || !data.briefing) {
        throw new Error(data.error || 'Failed to generate briefing');
      }
      setBriefingText(data.briefing);
      setBriefingNotice(
        data.deterministicFallback ? data.fallbackReason || null : null
      );
      await fetchAlerts();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Briefing generation failed'
      );
    } finally {
      setGeneratingBriefing(false);
    }
  };

  const handleAskQuestion = async (promptOverride?: string) => {
    const q = (promptOverride ?? question).trim();
    if (!q) {
      return;
    }
    if (promptOverride) {
      setQuestion(promptOverride);
    }
    setAskingAi(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          question: q,
          ...(unitFilter !== 'ALL' ? { businessUnit: unitFilter } : {}),
        }),
      });
      const data = (await res.json()) as {
        generation?: AiGenerationResult;
        error?: string;
      };
      if (!res.ok || !data.generation) {
        throw new Error(data.error || 'AI query failed');
      }
      setChatResult(data.generation);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AI query failed');
    } finally {
      setAskingAi(false);
    }
  };

  return (
    <Stack gap="lg">
      {errorMsg && (
        <Alert color="red" title="AI Assistant Notice">
          {errorMsg}
        </Alert>
      )}

      <Paper withBorder p="lg" radius="md">
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Group gap="xs">
                <IconRadar size={20} />
                <Text fw={700} size="lg">
                  24/7 Deterministic Monitoring & Anomaly Feed
                </Text>
              </Group>
              <Text size="sm" c="dimmed">
                Deterministic rules scan Clothing, Trucking, and General
                Merchandise for overdue invoices, accounting mismatches,
                recurring obligations, and negative stock—even when AI is
                offline.
              </Text>
            </div>

            <Group gap="sm">
              {alerts.length > 0 && (
                <Button
                  variant="default"
                  leftSection={
                    copiedKey === 'all-alerts' ? (
                      <IconCheck size={16} />
                    ) : (
                      <IconCopy size={16} />
                    )
                  }
                  color={copiedKey === 'all-alerts' ? 'teal' : undefined}
                  onClick={() =>
                    handleCopyText(
                      'all-alerts',
                      formatAllAlertsForCopy(alerts, unitFilter, statusFilter)
                    )
                  }
                >
                  {copiedKey === 'all-alerts'
                    ? `Copied ${alerts.length} Alerts!`
                    : `Copy All Results (${alerts.length})`}
                </Button>
              )}
              <Button
                variant="light"
                color="teal"
                leftSection={<IconRadar size={16} />}
                loading={runningScan}
                onClick={handleRunMonitorNow}
              >
                Run Deterministic Scan Now
              </Button>
              <Button
                variant="filled"
                color="indigo"
                leftSection={<IconSun size={16} />}
                loading={generatingBriefing}
                onClick={handleGenerateBriefing}
              >
                Generate Morning Briefing
              </Button>
            </Group>
          </Group>

          <Group gap="md">
            <Select
              label="Business Unit Scope"
              data={[
                { value: 'ALL', label: 'All Authorized Businesses' },
                { value: 'clothing', label: 'Clothing Wholesale' },
                { value: 'trucking', label: 'Trucking & Logistics' },
                {
                  value: 'general-merchandise',
                  label: 'General Merchandise',
                },
              ]}
              value={unitFilter}
              onChange={(val) => setUnitFilter(val || 'ALL')}
            />
            <Select
              label="Alert Status"
              data={[
                { value: 'OPEN', label: 'Open Alerts' },
                { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
                { value: 'RESOLVED', label: 'Resolved' },
                { value: 'ALL', label: 'All Statuses' },
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val || 'OPEN')}
            />
          </Group>

          {briefingText && (
            <Paper withBorder p="md" radius="sm" bg="indigo.0">
              <Group justify="space-between" mb="xs">
                <Text fw={700} size="sm">
                  Daily Multi-Business Executive Briefing
                </Text>
                <Group gap="xs">
                  {briefingNotice && (
                    <Badge color="orange" variant="light">
                      Deterministic Fallback ({briefingNotice})
                    </Badge>
                  )}
                  <Button
                    size="compact-xs"
                    variant="white"
                    color={copiedKey === 'briefing' ? 'teal' : 'dark'}
                    leftSection={
                      copiedKey === 'briefing' ? (
                        <IconCheck size={12} />
                      ) : (
                        <IconCopy size={12} />
                      )
                    }
                    onClick={() => handleCopyText('briefing', briefingText)}
                  >
                    {copiedKey === 'briefing' ? 'Copied' : 'Copy Briefing'}
                  </Button>
                </Group>
              </Group>
              <Code block style={{ whiteSpace: 'pre-wrap' }}>
                {briefingText}
              </Code>
            </Paper>
          )}

          <Divider />

          {loadingAlerts ? (
            <Group justify="center" py="lg">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Loading monitoring alerts...
              </Text>
            </Group>
          ) : alerts.length === 0 ? (
            <Alert color="teal" icon={<IconCheck size={16} />}>
              No {statusFilter !== 'ALL' ? statusFilter.toLowerCase() : ''}{' '}
              anomalies found for the selected scope. Click &quot;Run
              Deterministic Scan Now&quot; to audit live records.
            </Alert>
          ) : (
            <Stack gap="sm">
              {alerts.map((alert) => (
                <Paper key={alert.id} withBorder p="md" radius="sm">
                  <Stack gap="xs">
                    <Group justify="space-between" wrap="wrap">
                      <Group gap="xs">
                        <Badge
                          color={
                            alert.severity === 'CRITICAL'
                              ? 'red'
                              : alert.severity === 'WARNING'
                                ? 'orange'
                                : 'blue'
                          }
                        >
                          {alert.severity}
                        </Badge>
                        <Badge variant="outline" color="dark">
                          {alert.businessUnit}
                        </Badge>
                        <Badge variant="light" color="gray">
                          {alert.category}
                        </Badge>
                        <Text fw={600} size="sm">
                          {alert.title}
                        </Text>
                      </Group>

                      <Group gap="xs">
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          color={
                            copiedKey === `alert-${alert.id}` ? 'teal' : 'gray'
                          }
                          leftSection={
                            copiedKey === `alert-${alert.id}` ? (
                              <IconCheck size={12} />
                            ) : (
                              <IconCopy size={12} />
                            )
                          }
                          onClick={() =>
                            handleCopyText(
                              `alert-${alert.id}`,
                              formatSingleAlertForCopy(alert)
                            )
                          }
                        >
                          {copiedKey === `alert-${alert.id}`
                            ? 'Copied'
                            : 'Copy'}
                        </Button>
                        {alert.sourceLink && (
                          <Button
                            component={Link}
                            href={alert.sourceLink}
                            size="compact-xs"
                            variant="subtle"
                            rightSection={<IconExternalLink size={12} />}
                          >
                            View Source
                          </Button>
                        )}
                        <Button
                          size="compact-xs"
                          variant="light"
                          color="grape"
                          leftSection={<IconSparkles size={12} />}
                          loading={explainingId === alert.id}
                          onClick={() => handleExplainAlert(alert.id)}
                        >
                          Explain with AI
                        </Button>
                        {alert.status === 'OPEN' && (
                          <Button
                            size="compact-xs"
                            variant="default"
                            onClick={() =>
                              handleUpdateAlertStatus(alert.id, 'acknowledge')
                            }
                          >
                            Acknowledge
                          </Button>
                        )}
                        {alert.status !== 'RESOLVED' && (
                          <Button
                            size="compact-xs"
                            variant="light"
                            color="teal"
                            onClick={() =>
                              handleUpdateAlertStatus(alert.id, 'resolve')
                            }
                          >
                            Resolve
                          </Button>
                        )}
                      </Group>
                    </Group>

                    <Text size="sm">{alert.deterministicSummary}</Text>

                    {alert.aiExplanation && (
                      <Paper withBorder p="sm" radius="xs" bg="gray.0">
                        <Group justify="space-between" mb={4}>
                          <Text size="xs" fw={700} c="grape">
                            AI Auditor Investigation & Recommendation
                          </Text>
                          {alert.aiModelUsed && (
                            <Badge size="xs" color="grape" variant="light">
                              {alert.aiModelUsed}
                            </Badge>
                          )}
                        </Group>
                        <Code block style={{ whiteSpace: 'pre-wrap' }}>
                          {alert.aiExplanation}
                        </Code>
                      </Paper>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper withBorder p="lg" radius="md">
        <Stack gap="md">
          <Group gap="xs">
            <IconMessageChatbot size={20} />
            <Text fw={700} size="lg">
              Read-Only AI Business Auditor & Q&amp;A
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            Ask questions about overdue invoices, payment discrepancies,
            recurring obligations, or employee schedules. The AI uses
            RBAC-scoped read-only tools and never modifies financial records.
          </Text>

          <Group gap="xs" wrap="wrap">
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                handleAskQuestion(
                  'Check for any accounting discrepancies or paid orders with non-zero balances and explain how to verify them.'
                )
              }
            >
              Audit Accounting Discrepancies
            </Button>
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                handleAskQuestion(
                  'Show overdue invoices and pending receivables across my authorized business units and draft polite follow-up reminders.'
                )
              }
            >
              Overdue Invoices &amp; Follow-up Drafts
            </Button>
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                handleAskQuestion(
                  'What recurring loan or expense obligations are coming due soon?'
                )
              }
            >
              Upcoming Recurring Obligations
            </Button>
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                handleAskQuestion(
                  'Summarize upcoming employee schedules and any pending leave requests.'
                )
              }
            >
              Employee Schedules &amp; Leaves
            </Button>
          </Group>

          <Textarea
            placeholder="Ask a question about your Clothing, Trucking, or General Merchandise records..."
            minRows={3}
            value={question}
            onChange={(e) => setQuestion(e.currentTarget.value)}
          />

          <Group justify="flex-end">
            <Button
              color="blue"
              leftSection={<IconAlertTriangle size={16} />}
              loading={askingAi}
              onClick={() => handleAskQuestion()}
            >
              Ask Read-Only AI Auditor
            </Button>
          </Group>

          {chatResult && (
            <Paper withBorder p="md" radius="sm" bg="gray.0">
              <Stack gap="xs">
                <Group justify="space-between" wrap="wrap">
                  <Group gap="xs">
                    <Badge color="blue">
                      {chatResult.provider}:{chatResult.model}
                    </Badge>
                    <Badge color="teal" variant="light">
                      {chatResult.latencyMs} ms
                    </Badge>
                    <Badge color="gray" variant="light">
                      {chatResult.inputTokens + chatResult.outputTokens} tokens
                      (${chatResult.estimatedCostUsd.toFixed(6)})
                    </Badge>
                    <Button
                      size="compact-xs"
                      variant="default"
                      color={copiedKey === 'chat-result' ? 'teal' : undefined}
                      leftSection={
                        copiedKey === 'chat-result' ? (
                          <IconCheck size={12} />
                        ) : (
                          <IconCopy size={12} />
                        )
                      }
                      onClick={() =>
                        handleCopyText('chat-result', chatResult.text)
                      }
                    >
                      {copiedKey === 'chat-result' ? 'Copied' : 'Copy'}
                    </Button>
                  </Group>
                  {chatResult.toolsCalled.length > 0 && (
                    <Group gap={4}>
                      <Text size="xs" c="dimmed">
                        Read-only tools used:
                      </Text>
                      {chatResult.toolsCalled.map((tc) => (
                        <Badge
                          key={`${tc.toolName}-${tc.durationMs}`}
                          size="xs"
                          variant="outline"
                        >
                          {tc.toolName} ({tc.durationMs}ms)
                        </Badge>
                      ))}
                    </Group>
                  )}
                </Group>
                <Code block style={{ whiteSpace: 'pre-wrap' }}>
                  {chatResult.text}
                </Code>
              </Stack>
            </Paper>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
