'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Group,
  Loader,
  Paper,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import type { AiAssistantConfig, AiProviderId } from '@/lib/ai/types';
import { AiProviderSettingsCard } from './AiProviderSettingsCard';
import { AiAssistantWorkspaceCard } from './AiAssistantWorkspaceCard';

interface AuditLogRow {
  id: string;
  createdAt: string;
  userName: string | null;
  triggerSource: string;
  businessUnit: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  status: string;
}

export function AiAssistantTab() {
  const [settings, setSettings] = useState<AiAssistantConfig | null>(null);
  const [recommendedModels, setRecommendedModels] = useState<
    Record<AiProviderId, string[]>
  >({
    ollama: ['qwen3:8b', 'qwen3:14b', 'qwen3:4b'],
    google: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    openai: ['gpt-4o-mini', 'gpt-4o'],
  });
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch('/api/settings/ai-assistant');
        const data = (await res.json()) as {
          settings?: AiAssistantConfig;
          recommendedModels?: Record<AiProviderId, string[]>;
          recentAuditLogs?: AuditLogRow[];
          error?: string;
        };
        if (!res.ok || !data.settings) {
          throw new Error(data.error || 'Failed to load AI settings');
        }
        if (active) {
          setSettings(data.settings);
          if (data.recommendedModels) {
            setRecommendedModels(data.recommendedModels);
          }
          if (data.recentAuditLogs) {
            setAuditLogs(data.recentAuditLogs);
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Failed to load AI settings'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Loading AI Business Assistant configuration...
        </Text>
      </Group>
    );
  }

  if (error || !settings) {
    return (
      <Alert color="red" title="Error loading AI Assistant">
        {error || 'Unable to load settings.'}
      </Alert>
    );
  }

  return (
    <Stack gap="lg">
      <AiProviderSettingsCard
        initialSettings={settings}
        recommendedModels={recommendedModels}
        onSettingsUpdated={setSettings}
      />

      <AiAssistantWorkspaceCard />

      <Paper withBorder p="lg" radius="md">
        <Stack gap="sm">
          <Text fw={700} size="md">
            AI Execution &amp; Tool Audit Trail
          </Text>
          <Text size="xs" c="dimmed">
            Every AI invocation logs the provider, model, trigger source, token
            counts, latency, and read-only tools accessed.
          </Text>

          {auditLogs.length === 0 ? (
            <Text size="sm" c="dimmed">
              No AI executions recorded yet.
            </Text>
          ) : (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Timestamp</Table.Th>
                  <Table.Th>Source</Table.Th>
                  <Table.Th>Business</Table.Th>
                  <Table.Th>Provider / Model</Table.Th>
                  <Table.Th>Tokens</Table.Th>
                  <Table.Th>Est. Cost</Table.Th>
                  <Table.Th>Latency</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {auditLogs.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      {new Date(row.createdAt).toLocaleString()}
                    </Table.Td>
                    <Table.Td>{row.triggerSource}</Table.Td>
                    <Table.Td>{row.businessUnit || 'All'}</Table.Td>
                    <Table.Td>
                      {row.provider}:{row.model}
                    </Table.Td>
                    <Table.Td>{row.inputTokens + row.outputTokens}</Table.Td>
                    <Table.Td>${row.estimatedCostUsd.toFixed(6)}</Table.Td>
                    <Table.Td>{row.latencyMs} ms</Table.Td>
                    <Table.Td>
                      <Badge
                        size="xs"
                        color={row.status === 'SUCCESS' ? 'teal' : 'red'}
                      >
                        {row.status}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
