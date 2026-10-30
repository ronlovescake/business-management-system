import fs from 'node:fs';
import path from 'node:path';
import { providerFetch } from './provider-http';
import type {
  AiConnectionTestResult,
  AiGenerationResult,
  AiProviderId,
  AiToolCallTrace,
  AiToolDefinition,
  AiToolExecutionContext,
} from './types';

export const RECOMMENDED_MODELS: Record<AiProviderId, string[]> = {
  ollama: ['qwen3:8b', 'qwen3:14b', 'qwen3:4b', 'qwen3:32b', 'llama3.1:8b'],
  google: [
    'gemini-3.8-flash',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-pro-latest',
  ],
  openai: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
  copilot: ['auto'],
};

const MODEL_PRICING_PER_MILLION: Record<
  string,
  { inputUsd: number; outputUsd: number }
> = {
  'gemini-flash-latest': { inputUsd: 0.15, outputUsd: 0.6 },
  'gemini-3.8-flash': { inputUsd: 0.15, outputUsd: 0.6 },
  'gemini-2.5-flash': { inputUsd: 0.15, outputUsd: 0.6 },
  'gemini-2.5-pro': { inputUsd: 1.25, outputUsd: 10.0 },
  'gemini-2.0-flash': { inputUsd: 0.1, outputUsd: 0.4 },
  'gpt-4o-mini': { inputUsd: 0.15, outputUsd: 0.6 },
  'gpt-4o': { inputUsd: 2.5, outputUsd: 10.0 },
  'o3-mini': { inputUsd: 1.1, outputUsd: 4.4 },
};

export function estimateModelCostUsd(
  provider: AiProviderId,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  if (provider === 'ollama' || provider === 'copilot') {
    return 0;
  }

  const rates = MODEL_PRICING_PER_MILLION[model] ?? {
    inputUsd: 0.15,
    outputUsd: 0.6,
  };

  const cost =
    (Math.max(0, inputTokens) / 1_000_000) * rates.inputUsd +
    (Math.max(0, outputTokens) / 1_000_000) * rates.outputUsd;

  return Number(cost.toFixed(6));
}

export function readLiveEnvValue(keys: string[]): string {
  // Check live .env.local / .env.docker on disk first (outside unit tests) so hot swaps work without restarting Next.js
  if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
    const envFiles = ['.env.local', '.env.docker'];
    for (const file of envFiles) {
      try {
        const fullPath = path.join(process.cwd(), file);
        if (!fs.existsSync(fullPath)) {
          continue;
        }
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) {
            continue;
          }
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx === -1) {
            continue;
          }
          const k = trimmed.slice(0, eqIdx).trim();
          if (keys.includes(k)) {
            const rawVal = trimmed
              .slice(eqIdx + 1)
              .trim()
              .replace(/^["']|["']$/g, '');
            if (rawVal) {
              return rawVal;
            }
          }
        }
      } catch {
        // Ignore filesystem errors in edge/test environments
      }
    }
  }

  for (const k of keys) {
    const val = (process.env[k] || '').trim();
    if (val) {
      return val;
    }
  }

  return '';
}

function getGeminiApiKey(): string {
  const key = readLiveEnvValue([
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'GEMINI_API_KEY',
  ]);
  if (!key) {
    throw new Error(
      'GOOGLE_GENERATIVE_AI_API_KEY is not configured on the server.'
    );
  }
  return key;
}

function getOpenAiApiKey(): string {
  const key = readLiveEnvValue(['OPENAI_API_KEY']);
  if (!key) {
    throw new Error('OPENAI_API_KEY is not configured on the server.');
  }
  return key;
}

export async function discoverProviderModels(
  provider: AiProviderId,
  ollamaBaseUrl = 'http://host.docker.internal:11434'
): Promise<string[]> {
  const defaults = RECOMMENDED_MODELS[provider] ?? [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);

  try {
    if (provider === 'copilot') {
      const { discoverCopilotModels } = await import('./copilot-provider');
      return await discoverCopilotModels();
    }
    if (provider === 'ollama') {
      const cleanBase = ollamaBaseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
      const res = await providerFetch(`${cleanBase}/api/tags`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        return defaults;
      }
      const data = (await res.json()) as {
        models?: Array<{ name?: string }>;
      };
      const installed = (data.models ?? [])
        .map((m) => m.name)
        .filter((name): name is string => Boolean(name));
      return Array.from(new Set([...installed, ...defaults]));
    }

    if (provider === 'google') {
      const apiKey = getGeminiApiKey();
      const res = await providerFetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        { signal: controller.signal }
      );
      if (!res.ok) {
        return defaults;
      }
      const data = (await res.json()) as {
        models?: Array<{
          name?: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      const found = (data.models ?? [])
        .filter((m) =>
          m.supportedGenerationMethods?.includes('generateContent')
        )
        .map((m) => (m.name || '').replace(/^models\//, ''))
        .filter(
          (name) =>
            name.startsWith('gemini-') &&
            !name.startsWith('gemini-1.') &&
            !name.startsWith('gemini-2.0') &&
            !name.startsWith('gemini-2.5-flash') &&
            !name.includes('embedding') &&
            !name.includes('imagen') &&
            !name.includes('tts') &&
            !name.includes('vision')
        );
      return Array.from(new Set([...defaults, ...found])).slice(0, 15);
    }

    if (provider === 'openai') {
      const apiKey = getOpenAiApiKey();
      const res = await providerFetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        return defaults;
      }
      const data = (await res.json()) as {
        data?: Array<{ id?: string }>;
      };
      const found = (data.data ?? [])
        .map((m) => m.id || '')
        .filter((id) => /^(gpt-4o|gpt-4\.1|o3|o4|luna)/i.test(id));
      return Array.from(new Set([...defaults, ...found])).slice(0, 15);
    }
  } catch {
    return defaults;
  } finally {
    clearTimeout(timer);
  }

  return defaults;
}

export async function testProviderConnection(params: {
  provider: AiProviderId;
  model: string;
  ollamaBaseUrl?: string;
}): Promise<AiConnectionTestResult> {
  const startTime = Date.now();
  const ollamaBase = (
    params.ollamaBaseUrl ||
    process.env.OLLAMA_BASE_URL ||
    'http://host.docker.internal:11434'
  )
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '');

  try {
    const res = await generateWithProvider({
      provider: params.provider,
      model: params.model,
      ollamaBaseUrl: ollamaBase,
      systemPrompt: 'Reply with the single word READY.',
      userPrompt: 'READY',
      isSyntheticTest: true,
      tools: [],
      toolContext: {
        userId: null,
        userRole: 'SUPER_ADMIN',
        accessibleModules: [],
        allowedBusinessUnits: [],
      },
      timeoutMs: 90000,
      maxOutputTokens: 32,
    });

    const discoveredModels = RECOMMENDED_MODELS[params.provider] ?? [res.model];

    return {
      ok: true,
      provider: params.provider,
      model: res.model,
      latencyMs: Date.now() - startTime,
      message: `Connected to ${params.provider} (${res.model}). Model replied: "${res.text.slice(0, 80).trim()}"`,
      discoveredModels: Array.from(new Set([res.model, ...discoveredModels])),
    };
  } catch (error) {
    return {
      ok: false,
      provider: params.provider,
      model: params.model,
      latencyMs: Date.now() - startTime,
      message:
        error instanceof Error
          ? error.message
          : 'Failed to connect to AI provider',
      discoveredModels: RECOMMENDED_MODELS[params.provider] ?? [],
    };
  }
}

export interface AiChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateWithProviderParams {
  provider: AiProviderId;
  model: string;
  ollamaBaseUrl?: string;
  systemPrompt: string;
  userPrompt: string;
  /** Prior conversation turns (oldest first), excluding the current userPrompt. */
  history?: AiChatHistoryMessage[];
  tools: AiToolDefinition[];
  toolContext: AiToolExecutionContext;
  timeoutMs?: number;
  maxOutputTokens?: number;
  isSyntheticTest?: boolean;
}

export async function generateWithProvider(
  params: GenerateWithProviderParams
): Promise<Omit<AiGenerationResult, 'usedFallback'>> {
  if (params.provider === 'copilot') {
    const { generateWithCopilot } = await import('./copilot-provider');
    return generateWithCopilot(params);
  }
  if (params.provider === 'google') {
    return generateWithGemini(params);
  }
  return generateWithOpenAiCompatible(params);
}

async function generateWithOpenAiCompatible(
  params: GenerateWithProviderParams
): Promise<Omit<AiGenerationResult, 'usedFallback'>> {
  const startTime = Date.now();
  const isOllama = params.provider === 'ollama';
  const baseUrl = isOllama
    ? `${(params.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434').replace(/\/+$/, '').replace(/\/v1$/, '')}/v1`
    : 'https://api.openai.com/v1';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (!isOllama) {
    headers.Authorization = `Bearer ${getOpenAiApiKey()}`;
  }

  const toolMap = new Map(params.tools.map((t) => [t.name, t]));
  const openAiTools =
    params.tools.length > 0
      ? params.tools.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }))
      : undefined;

  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: params.systemPrompt },
    ...(params.history ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: params.userPrompt },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolsCalled: AiToolCallTrace[] = [];

  for (let round = 0; round < 4; round += 1) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      params.timeoutMs ?? 30000
    );

    let data: {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      error?: { message?: string };
    };

    try {
      const response = await providerFetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: params.model,
          messages,
          ...(openAiTools && round < 3 ? { tools: openAiTools } : {}),
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      data = (await response.json()) as typeof data;
      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
            `${params.provider} request failed with HTTP ${response.status}`
        );
      }
    } finally {
      clearTimeout(timer);
    }

    totalInputTokens += data.usage?.prompt_tokens ?? 0;
    totalOutputTokens += data.usage?.completion_tokens ?? 0;

    const choiceMsg = data.choices?.[0]?.message;
    if (!choiceMsg) {
      throw new Error(
        `Empty response from ${params.provider} (${params.model})`
      );
    }

    const toolCalls = choiceMsg.tool_calls ?? [];
    if (!toolCalls.length) {
      const text = (choiceMsg.content || '').trim();
      return {
        text,
        provider: params.provider,
        model: params.model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        estimatedCostUsd: estimateModelCostUsd(
          params.provider,
          params.model,
          totalInputTokens,
          totalOutputTokens
        ),
        latencyMs: Date.now() - startTime,
        toolsCalled,
      };
    }

    messages.push({
      role: 'assistant',
      content: choiceMsg.content ?? null,
      tool_calls: toolCalls,
    });

    for (const tc of toolCalls) {
      const toolDef = toolMap.get(tc.function.name);
      const callStart = Date.now();
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = tc.function.arguments
          ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
          : {};
      } catch {
        parsedArgs = {};
      }

      let toolOutput: unknown;
      if (!toolDef) {
        toolOutput = {
          error: `Tool "${tc.function.name}" is not allowlisted.`,
        };
      } else {
        try {
          toolOutput = await toolDef.execute(parsedArgs, params.toolContext);
        } catch (err) {
          toolOutput = {
            error: err instanceof Error ? err.message : 'Tool execution error',
          };
        }
      }

      toolsCalled.push({
        toolName: tc.function.name,
        args: parsedArgs,
        durationMs: Date.now() - callStart,
      });

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(toolOutput),
      });
    }
  }

  throw new Error('Exceeded maximum read-only tool call rounds');
}

function getGeminiGenerativeLanguageUrl(model: string, apiKey: string): string {
  const cleanModel = model.replace(/^models\//, '');
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function normalizeGeminiModel(rawModel: string): string {
  const clean = rawModel.replace(/^models\//, '').trim();
  // Map retired Gemini 1.5 / 2.0 / 2.5 models directly to gemini-3.8-flash so we never trigger 404 NotFound
  if (
    !clean ||
    clean === 'gemini-2.5-flash' ||
    clean === 'gemini-2.0-flash' ||
    clean.startsWith('gemini-1.5') ||
    clean === 'gemini-flash-latest' ||
    clean === 'gemini-flash-lite-latest'
  ) {
    return 'gemini-3.8-flash';
  }
  return clean;
}

async function generateWithGemini(
  params: GenerateWithProviderParams
): Promise<Omit<AiGenerationResult, 'usedFallback'>> {
  const startTime = Date.now();
  const apiKey = getGeminiApiKey();
  const toolMap = new Map(params.tools.map((t) => [t.name, t]));
  let effectiveModel = normalizeGeminiModel(params.model);

  const contents: Array<Record<string, unknown>> = [
    ...(params.history ?? []).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: params.userPrompt }] },
  ];

  const geminiTools =
    params.tools.length > 0
      ? [
          {
            functionDeclarations: params.tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            })),
          },
        ]
      : undefined;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolsCalled: AiToolCallTrace[] = [];

  for (let round = 0; round < 4; round += 1) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      params.timeoutMs ?? 150000
    );

    let data: {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            thought?: boolean;
            functionCall?: {
              name: string;
              args?: Record<string, unknown>;
            };
          }>;
        };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
      error?: { message?: string };
    };

    try {
      const requestBody = JSON.stringify({
        systemInstruction: {
          parts: [{ text: params.systemPrompt }],
        },
        contents,
        ...(geminiTools && round < 3 ? { tools: geminiTools } : {}),
        generationConfig: {
          temperature: 0.1,
          ...(params.maxOutputTokens
            ? { maxOutputTokens: params.maxOutputTokens }
            : {}),
        },
      });

      let response = await providerFetch(
        getGeminiGenerativeLanguageUrl(effectiveModel, apiKey),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
          signal: controller.signal,
        }
      );

      data = (await response.json()) as typeof data;

      // If Google instructs us to use a newer model on 404, switch to that exact model
      if (!response.ok && response.status === 404) {
        const errMsg = data?.error?.message || '';
        const suggestedMatch = errMsg.match(/models\/([a-zA-Z0-9._-]+)/);
        const suggestedModel = suggestedMatch?.[1] || 'gemini-3.8-flash';
        if (suggestedModel !== effectiveModel) {
          effectiveModel = suggestedModel;
          response = await providerFetch(
            getGeminiGenerativeLanguageUrl(effectiveModel, apiKey),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: requestBody,
              signal: controller.signal,
            }
          );
          data = (await response.json()) as typeof data;
        }
      }

      const rawErrMsg = data?.error?.message || '';
      const isDailyQuotaExhausted =
        response.status === 429 &&
        /exceeded your current quota|requests per day|free_tier_requests/i.test(
          rawErrMsg
        );

      // Only retry transient 503 demand spikes (never retry daily quota exhaustion)
      for (
        let backoffAttempt = 0;
        !response.ok &&
        !isDailyQuotaExhausted &&
        response.status === 503 &&
        backoffAttempt < 2;
        backoffAttempt += 1
      ) {
        await new Promise((r) => setTimeout(r, 2500 * (backoffAttempt + 1)));
        const retryRes = await providerFetch(
          getGeminiGenerativeLanguageUrl(effectiveModel, apiKey),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody,
            signal: controller.signal,
          }
        );
        const retryData = (await retryRes.json()) as typeof data;
        response = retryRes;
        data = retryData;
      }

      if (!response.ok) {
        if (isDailyQuotaExhausted) {
          const limitMatch = rawErrMsg.match(/limit:\s*(\d+)/i);
          const retryMatch = rawErrMsg.match(
            /Please retry in\s+([^.\n]+(?:\.\d+s)?)/i
          );
          const limitInfo = limitMatch
            ? ` (daily limit: ${limitMatch[1]} requests)`
            : '';
          const retryInfo = retryMatch
            ? ` Retry in ${retryMatch[1].trim()}.`
            : '';
          throw new Error(
            `Gemini Free Tier daily request quota reached for ${effectiveModel}${limitInfo}.${retryInfo} Local deterministic PostgreSQL monitoring remains active.`
          );
        }
        throw new Error(
          data?.error?.message ||
            `Gemini request failed with HTTP ${response.status}`
        );
      }
    } finally {
      clearTimeout(timer);
    }

    totalInputTokens += data.usageMetadata?.promptTokenCount ?? 0;
    totalOutputTokens += data.usageMetadata?.candidatesTokenCount ?? 0;

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const fnCalls = parts
      .map((p) => p.functionCall)
      .filter((fc): fc is NonNullable<typeof fc> => Boolean(fc));

    if (!fnCalls.length) {
      const visibleParts = parts.filter((p) => !p.thought && p.text);
      const textSource = visibleParts.length > 0 ? visibleParts : parts;
      const text = textSource
        .map((p) => p.text || '')
        .join('\n')
        .trim();
      return {
        text,
        provider: 'google',
        model: effectiveModel,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        estimatedCostUsd: estimateModelCostUsd(
          'google',
          effectiveModel,
          totalInputTokens,
          totalOutputTokens
        ),
        latencyMs: Date.now() - startTime,
        toolsCalled,
      };
    }

    contents.push({ role: 'model', parts });
    const responseParts: Array<Record<string, unknown>> = [];

    for (const fc of fnCalls) {
      const toolDef = toolMap.get(fc.name);
      const callStart = Date.now();
      const args = fc.args ?? {};
      let toolOutput: unknown;

      if (!toolDef) {
        toolOutput = { error: `Tool "${fc.name}" is not allowlisted.` };
      } else {
        try {
          toolOutput = await toolDef.execute(args, params.toolContext);
        } catch (err) {
          toolOutput = {
            error: err instanceof Error ? err.message : 'Tool execution error',
          };
        }
      }

      toolsCalled.push({
        toolName: fc.name,
        args,
        durationMs: Date.now() - callStart,
      });

      responseParts.push({
        functionResponse: {
          name: fc.name,
          response: { result: toolOutput },
        },
      });
    }

    contents.push({ role: 'user', parts: responseParts });
  }

  throw new Error('Exceeded maximum Gemini read-only tool call rounds');
}
