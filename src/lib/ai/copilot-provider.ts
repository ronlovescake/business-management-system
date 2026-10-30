import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { readLiveEnvValue } from './providers';
import type { GenerateWithProviderParams } from './providers';
import type {
  AiGenerationResult,
  AiToolCallTrace,
  AiProviderFailureDiagnostics,
} from './types';

async function createClient() {
  const token = readLiveEnvValue(['COPILOT_GITHUB_TOKEN']);
  if (!token) {
    throw new Error('COPILOT_GITHUB_TOKEN is not configured on the server.');
  }
  const { CopilotClient } = await import('@github/copilot-sdk');
  const directory = await mkdtemp(path.join(tmpdir(), 'business-copilot-'));
  const client = new CopilotClient({
    mode: 'empty',
    gitHubToken: token,
    useLoggedInUser: false,
    workingDirectory: directory,
    baseDirectory: directory,
    logLevel: 'none',
    env: {
      PATH: process.env.PATH,
      HOME: directory,
      COPILOT_GITHUB_TELEMETRY_DISABLED: 'true',
    },
  });
  return {
    client,
    token,
    async cleanup() {
      try {
        await client.forceStop();
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}

export async function discoverCopilotModels(): Promise<string[]> {
  const { client, cleanup } = await createClient();
  const timer = setTimeout(() => void client.forceStop(), 10000);
  try {
    await client.start();
    const models = await client.listModels();
    return Array.from(new Set(['auto', ...models.map((model) => model.id)]));
  } finally {
    clearTimeout(timer);
    await cleanup();
  }
}

export function assertCopilotAccess(params: GenerateWithProviderParams): void {
  const allowed = (readLiveEnvValue(['COPILOT_ALLOWED_USER_ID']) || '').trim();
  const currentUserId = params.toolContext.userId || '';
  const currentUserEmail = (params.toolContext.userEmail || '').toLowerCase();

  const isAllowed =
    Boolean(currentUserId) &&
    Boolean(allowed) &&
    (allowed === 'SUPER_ADMIN'
      ? params.toolContext.userRole === 'SUPER_ADMIN'
      : currentUserId === allowed ||
        (Boolean(currentUserEmail) &&
          currentUserEmail === allowed.toLowerCase()));

  if (!params.isSyntheticTest && !isAllowed) {
    throw new Error(
      'Copilot is restricted to the configured COPILOT_ALLOWED_USER_ID.'
    );
  }
}

export async function generateWithCopilot(
  params: GenerateWithProviderParams
): Promise<Omit<AiGenerationResult, 'usedFallback'>> {
  assertCopilotAccess(params);
  const started = Date.now();
  const { client, token, cleanup } = await createClient();
  const timeoutMs = params.timeoutMs ?? 30000;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void client.forceStop().catch(() => undefined);
  }, timeoutMs);
  const toolsCalled: AiToolCallTrace[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let toolCalls = 0;
  let phase: AiProviderFailureDiagnostics['phase'] = 'runtime-start';
  const activeTools = new Map<number, string>();
  const completedCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }> = [];
  try {
    await client.start();
    const sdkStarted = Date.now();
    phase = 'session-setup';
    const session = await client.createSession({
      model: params.model,
      gitHubToken: token,
      systemMessage: { mode: 'append', content: params.systemPrompt },
      availableTools: params.tools.map((tool) => `custom:${tool.name}`),
      excludedTools: ['builtin:*', 'mcp:*'],
      enableConfigDiscovery: false,
      enableOnDemandInstructionDiscovery: false,
      enableFileHooks: false,
      enableHostGitOperations: false,
      enableSkills: false,
      enableSessionStore: false,
      enableSessionTelemetry: false,
      memory: { enabled: false },
      infiniteSessions: { enabled: false },
      onPermissionRequest: () => ({ kind: 'reject' }),
      tools: params.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        skipPermission: true,
        handler: async (args: unknown) => {
          if (toolCalls >= 12) {
            throw new Error('Exceeded maximum read-only tool calls');
          }
          toolCalls += 1;
          if (!args || typeof args !== 'object' || Array.isArray(args)) {
            throw new Error('Invalid tool arguments');
          }
          const parsedArgs = args as Record<string, unknown>;
          const callStarted = Date.now();
          const callId = toolCalls;
          const cached = completedCalls.find(
            (call) =>
              call.name === tool.name &&
              isDeepStrictEqual(call.args, parsedArgs)
          );
          if (cached) {
            toolsCalled.push({
              toolName: tool.name,
              args: parsedArgs,
              durationMs: 0,
              cacheHit: true,
            });
            return structuredClone(cached.result);
          }
          activeTools.set(callId, tool.name);
          try {
            const result = await tool.execute(parsedArgs, params.toolContext);
            completedCalls.push({
              name: tool.name,
              args: structuredClone(parsedArgs),
              result: structuredClone(result),
            });
            return result;
          } finally {
            activeTools.delete(callId);
            toolsCalled.push({
              toolName: tool.name,
              args: parsedArgs,
              durationMs: Date.now() - callStarted,
            });
          }
        },
      })),
    });
    const sessionStarted = Date.now();
    phase = 'model-response';
    session.on('assistant.usage', (event) => {
      inputTokens += event.data.inputTokens ?? 0;
      outputTokens += event.data.outputTokens ?? 0;
    });
    const response = await session.sendAndWait(
      {
        prompt: JSON.stringify({
          history: params.history ?? [],
          currentUserMessage: params.userPrompt,
        }),
      },
      timeoutMs
    );
    const text = response?.data.content.trim();
    if (!text) {
      throw new Error(`Empty response from copilot (${params.model})`);
    }
    return {
      text,
      provider: 'copilot',
      model: params.model,
      inputTokens,
      outputTokens,
      estimatedCostUsd: 0,
      latencyMs: Date.now() - started,
      toolsCalled,
      timings: {
        sdkStartupMs: sdkStarted - started,
        sessionSetupMs: sessionStarted - sdkStarted,
        modelAndToolsMs: Date.now() - sessionStarted,
      },
    };
  } catch (error) {
    throw Object.assign(
      new Error(
        timedOut
          ? 'Copilot request timed out.'
          : error instanceof Error
            ? error.message
            : 'Copilot request failed.'
      ),
      {
        providerDiagnostics: {
          phase: activeTools.size > 0 ? 'tool-execution' : phase,
          elapsedMs: Date.now() - started,
          toolCallsStarted: toolCalls,
          toolCallsCompleted: toolsCalled.length,
          activeToolNames: Array.from(activeTools.values()),
        } satisfies AiProviderFailureDiagnostics,
      }
    );
  } finally {
    clearTimeout(timer);
    await cleanup();
  }
}
