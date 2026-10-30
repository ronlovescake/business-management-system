'use client';

import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Code,
  Divider,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import {
  IconCheck,
  IconCloudLock,
  IconCpu,
  IconPlugConnected,
  IconRefresh,
  IconTestPipe,
} from '@tabler/icons-react';
import type {
  AiAssistantConfig,
  AiConnectionTestResult,
  AiGenerationResult,
  AiProviderId,
} from '@/lib/ai/types';

interface AiProviderSettingsCardProps {
  initialSettings: AiAssistantConfig;
  recommendedModels: Record<AiProviderId, string[]>;
  onSettingsUpdated: (next: AiAssistantConfig) => void;
}

export function AiProviderSettingsCard({
  initialSettings,
  recommendedModels,
  onSettingsUpdated,
}: AiProviderSettingsCardProps) {
  const [activeProvider, setActiveProvider] = useState<AiProviderId>(
    initialSettings.activeProvider
  );
  const [activeModel, setActiveModel] = useState(initialSettings.activeModel);
  const [accountingModel, setAccountingModel] = useState(
    initialSettings.accountingModel ?? ''
  );
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(
    initialSettings.ollamaBaseUrl
  );
  const [fallbackProvider, setFallbackProvider] = useState<string>(
    initialSettings.fallbackProvider ?? 'none'
  );
  const [fallbackModel, setFallbackModel] = useState(
    initialSettings.fallbackModel ?? ''
  );
  const [allowCloudDataSharing, setAllowCloudDataSharing] = useState(
    initialSettings.allowCloudDataSharing
  );
  const [dailyTokenLimit, setDailyTokenLimit] = useState<number>(
    initialSettings.dailyTokenLimit
  );
  const [monthlyBudgetUsd, setMonthlyBudgetUsd] = useState<number>(
    initialSettings.monthlyBudgetUsd
  );
  const [monitoringEnabled, setMonitoringEnabled] = useState(
    initialSettings.monitoringEnabled
  );
  const [morningBriefingEnabled, setMorningBriefingEnabled] = useState(
    initialSettings.morningBriefingEnabled
  );
  const [morningBriefingTime, setMorningBriefingTime] = useState(
    initialSettings.morningBriefingTime
  );
  const [discoveredByProvider, setDiscoveredByProvider] =
    useState<Record<AiProviderId, string[]>>(recommendedModels);

  const [saving, setSaving] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [testingInvestigation, setTestingInvestigation] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [benchmarkOutput, setBenchmarkOutput] =
    useState<AiGenerationResult | null>(null);

  const availableModels = Array.from(
    new Set(
      [...(discoveredByProvider[activeProvider] ?? []), activeModel].filter(
        Boolean
      )
    )
  );

  const handleProviderChange = (val: string | null) => {
    if (!val) {
      return;
    }
    const nextProvider = val as AiProviderId;
    setActiveProvider(nextProvider);
    const defaultModel = discoveredByProvider[nextProvider]?.[0] ?? 'qwen3:8b';
    setActiveModel(defaultModel);
  };

  const handleDiscoverModels = async () => {
    setDiscovering(true);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/settings/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'discover-models',
          provider: activeProvider,
          ollamaBaseUrl,
        }),
      });
      const data = (await res.json()) as {
        models?: string[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Model discovery failed');
      }
      if (data.models?.length) {
        const discovered = data.models;
        setDiscoveredByProvider((prev) => ({
          ...prev,
          [activeProvider]: discovered,
        }));
        setStatusBanner({
          type: 'info',
          text: `Discovered ${discovered.length} models for ${activeProvider}.`,
        });
      }
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to discover models',
      });
    } finally {
      setDiscovering(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/settings/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-connection',
          provider: activeProvider,
          model: activeModel,
          ollamaBaseUrl,
        }),
      });
      const data = (await res.json()) as {
        result?: AiConnectionTestResult;
        error?: string;
      };
      if (!res.ok || !data.result) {
        throw new Error(data.error || 'Connection test failed');
      }
      if (data.result.discoveredModels?.length) {
        const discovered = data.result.discoveredModels;
        setDiscoveredByProvider((prev) => ({
          ...prev,
          [activeProvider]: discovered,
        }));
      }
      if (data.result.ok && data.result.model) {
        setActiveModel(data.result.model);
      }
      setStatusBanner({
        type: data.result.ok ? 'success' : 'error',
        text: `${data.result.message} (${data.result.latencyMs} ms)`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Connection test failed',
      });
    } finally {
      setTestingConn(false);
    }
  };

  const handleRunTestInvestigation = async () => {
    setTestingInvestigation(true);
    setStatusBanner(null);
    setBenchmarkOutput(null);
    try {
      const res = await fetch('/api/settings/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-investigation',
          provider: activeProvider,
          model: accountingModel.trim() || activeModel,
          ollamaBaseUrl,
        }),
      });
      const data = (await res.json()) as {
        result?: AiGenerationResult;
        error?: string;
      };
      if (!res.ok || !data.result) {
        throw new Error(data.error || 'Synthetic investigation failed');
      }
      setBenchmarkOutput(data.result);
      setStatusBanner({
        type: 'success',
        text: `Synthetic ₱2,000 Cash Discrepancy Benchmark completed in ${data.result.latencyMs} ms (${data.result.inputTokens + data.result.outputTokens} tokens, est. $${data.result.estimatedCostUsd.toFixed(6)}).`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text:
          err instanceof Error ? err.message : 'Synthetic investigation failed',
      });
    } finally {
      setTestingInvestigation(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/settings/ai-assistant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeProvider,
          activeModel: activeModel.trim(),
          accountingModel: accountingModel.trim() || null,
          ollamaBaseUrl: ollamaBaseUrl.trim(),
          fallbackProvider:
            fallbackProvider === 'none' ? null : fallbackProvider,
          fallbackModel: fallbackModel.trim() || null,
          allowCloudDataSharing,
          dailyTokenLimit: Number(dailyTokenLimit) || 250000,
          monthlyBudgetUsd: Number(monthlyBudgetUsd) || 15,
          monitoringEnabled,
          morningBriefingEnabled,
          morningBriefingTime,
          timezone: initialSettings.timezone || 'Asia/Manila',
        }),
      });
      const data = (await res.json()) as {
        settings?: AiAssistantConfig;
        error?: string;
      };
      if (!res.ok || !data.settings) {
        throw new Error(data.error || 'Failed to save settings');
      }
      onSettingsUpdated(data.settings);
      setStatusBanner({
        type: 'success',
        text: 'AI Assistant settings saved. Provider switch applied without container restart.',
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save settings',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper withBorder p="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="xs">
              <IconCpu size={20} />
              <Text fw={700} size="lg">
                Plug-and-Play AI Provider Registry
              </Text>
              <Badge color="teal" variant="light">
                Read-Only Enforced
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Switch between local LAN Ollama, Google Gemini API, and OpenAI API
              at runtime while sharing the exact same deterministic business
              tools and RBAC guardrails.
            </Text>
          </div>

          <Group gap="xs">
            <Badge
              color={
                initialSettings.credentials.ollamaConfigured ? 'teal' : 'gray'
              }
            >
              Ollama: Ready
            </Badge>
            <Badge
              color={initialSettings.credentials.hasGeminiKey ? 'blue' : 'gray'}
            >
              Gemini API Key:{' '}
              {initialSettings.credentials.hasGeminiKey ? 'Set' : 'Not Set'}
            </Badge>
            <Badge
              color={
                initialSettings.credentials.hasOpenAiKey ? 'violet' : 'gray'
              }
            >
              OpenAI API Key:{' '}
              {initialSettings.credentials.hasOpenAiKey ? 'Set' : 'Not Set'}
            </Badge>
            <Badge
              color={
                initialSettings.credentials.hasCopilotToken ? 'teal' : 'gray'
              }
            >
              Copilot Token:{' '}
              {initialSettings.credentials.hasCopilotToken ? 'Set' : 'Not Set'}
            </Badge>
          </Group>
        </Group>

        {statusBanner && (
          <Alert
            color={
              statusBanner.type === 'success'
                ? 'teal'
                : statusBanner.type === 'error'
                  ? 'red'
                  : 'blue'
            }
            title={statusBanner.type === 'error' ? 'Provider Notice' : 'Status'}
          >
            {statusBanner.text}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          <Select
            label="Active AI Provider"
            data={[
              { value: 'ollama', label: 'Ollama (Local LAN — Free / Private)' },
              { value: 'google', label: 'Google Gemini API (Cloud)' },
              { value: 'openai', label: 'OpenAI API / Luna (Cloud)' },
              { value: 'copilot', label: 'GitHub Copilot (Subscription)' },
            ]}
            value={activeProvider}
            onChange={handleProviderChange}
          />

          <Select
            label="Primary Model"
            searchable
            data={availableModels.map((m) => ({ value: m, label: m }))}
            value={activeModel}
            onChange={(val) => val && setActiveModel(val)}
          />

          <TextInput
            label="Custom / Exact Model ID"
            placeholder="e.g. qwen3:8b, gemini-2.5-flash, gpt-4o"
            value={activeModel}
            onChange={(e) => setActiveModel(e.currentTarget.value)}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          <TextInput
            label="Ollama Endpoint URL (Local / LAN)"
            placeholder="http://host.docker.internal:11434"
            value={ollamaBaseUrl}
            onChange={(e) => setOllamaBaseUrl(e.currentTarget.value)}
          />

          <TextInput
            label="Specialized Accounting Model (Optional)"
            placeholder="e.g. qwen3:14b or gemini-2.5-pro"
            value={accountingModel}
            onChange={(e) => setAccountingModel(e.currentTarget.value)}
          />

          <Group gap="xs" align="flex-end">
            <Select
              label="Fallback Provider"
              style={{ flex: 1 }}
              data={[
                { value: 'none', label: 'Disabled (Recommended)' },
                { value: 'ollama', label: 'Ollama (Local)' },
                { value: 'google', label: 'Google Gemini' },
                { value: 'openai', label: 'OpenAI' },
                { value: 'copilot', label: 'GitHub Copilot' },
              ]}
              value={fallbackProvider}
              onChange={(val) => setFallbackProvider(val || 'none')}
            />
            {fallbackProvider !== 'none' && (
              <TextInput
                label="Fallback Model"
                style={{ flex: 1 }}
                placeholder="qwen3:8b"
                value={fallbackModel}
                onChange={(e) => setFallbackModel(e.currentTarget.value)}
              />
            )}
          </Group>
        </SimpleGrid>

        <Divider />

        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <NumberInput
            label="Daily Token Limit"
            min={1000}
            step={25000}
            value={dailyTokenLimit}
            onChange={(val) => setDailyTokenLimit(Number(val) || 250000)}
          />

          <NumberInput
            label="Monthly Cloud Budget (USD)"
            min={0}
            decimalScale={2}
            prefix="$"
            value={monthlyBudgetUsd}
            onChange={(val) => setMonthlyBudgetUsd(Number(val) || 0)}
          />

          <TextInput
            label="Morning Briefing Time (24h)"
            placeholder="07:00"
            value={morningBriefingTime}
            onChange={(e) => setMorningBriefingTime(e.currentTarget.value)}
          />

          <Paper withBorder p="xs" radius="sm">
            <Text size="xs" c="dimmed" fw={600}>
              Today&apos;s Token Usage & Spend
            </Text>
            <Text size="sm" fw={700}>
              {initialSettings.usage.todayTotalTokens.toLocaleString()} /{' '}
              {dailyTokenLimit.toLocaleString()} tokens
            </Text>
            <Text size="xs" c="dimmed">
              Month Est. Spend: $
              {initialSettings.usage.monthEstimatedCostUsd.toFixed(4)} (
              {initialSettings.usage.todayRequestCount} calls today)
            </Text>
          </Paper>
        </SimpleGrid>

        <Group gap="xl" wrap="wrap">
          <Switch
            checked={allowCloudDataSharing}
            onChange={(e) => setAllowCloudDataSharing(e.currentTarget.checked)}
            color="orange"
            label={
              <Group gap={6}>
                <IconCloudLock size={16} />
                <Text size="sm" fw={500}>
                  Allow Cloud Data Sharing (Required for Gemini / OpenAI on real
                  records)
                </Text>
              </Group>
            }
          />

          <Switch
            checked={monitoringEnabled}
            onChange={(e) => setMonitoringEnabled(e.currentTarget.checked)}
            color="teal"
            label="Enable 24/7 Deterministic Background Monitoring"
          />

          <Switch
            checked={morningBriefingEnabled}
            onChange={(e) => setMorningBriefingEnabled(e.currentTarget.checked)}
            color="indigo"
            label="Enable Daily Morning Business Briefing"
          />
        </Group>

        <Group justify="space-between" wrap="wrap">
          <Group gap="sm">
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              loading={discovering}
              onClick={handleDiscoverModels}
            >
              Discover Models
            </Button>

            <Button
              variant="outline"
              color="teal"
              leftSection={<IconPlugConnected size={16} />}
              loading={testingConn}
              onClick={handleTestConnection}
            >
              Test Connection
            </Button>

            <Button
              variant="outline"
              color="grape"
              leftSection={<IconTestPipe size={16} />}
              loading={testingInvestigation}
              onClick={handleRunTestInvestigation}
            >
              Run Test Investigation
            </Button>
          </Group>

          <Button
            color="blue"
            leftSection={<IconCheck size={16} />}
            loading={saving}
            onClick={handleSave}
          >
            Save AI Settings
          </Button>
        </Group>

        {benchmarkOutput && (
          <Paper withBorder p="md" radius="sm" bg="gray.0">
            <Group justify="space-between" mb="xs">
              <Text fw={600} size="sm">
                Synthetic Cash Discrepancy Benchmark Output (
                {benchmarkOutput.provider}:{benchmarkOutput.model})
              </Text>
              <Badge color="grape">
                {benchmarkOutput.latencyMs} ms •{' '}
                {benchmarkOutput.inputTokens + benchmarkOutput.outputTokens}{' '}
                tokens
              </Badge>
            </Group>
            <Code block style={{ whiteSpace: 'pre-wrap' }}>
              {benchmarkOutput.text}
            </Code>
          </Paper>
        )}
      </Stack>
    </Paper>
  );
}
