import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readLiveEnvValue } from './providers';
import type { GenerateWithProviderParams } from './providers';
import type { AiGenerationResult, AiToolCallTrace } from './types';

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

export async function generateWithCopilot(
  params: GenerateWithProviderParams
): Promise<Omit<AiGenerationResult, 'usedFallback'>> {
  const allowedUserId = readLiveEnvValue(['COPILOT_ALLOWED_USER_ID']);
  if (
    !params.isSyntheticTest &&
    (!allowedUserId || params.toolContext.userId !== allowedUserId)
  ) {
    throw new Error(
      'Copilot is restricted to the configured COPILOT_ALLOWED_USER_ID.'
    );
  }
  const started = Date.now();
  const { client, token, cleanup } = await createClient();
  const timeoutMs = params.timeoutMs ?? 30000;
  const timer = setTimeout(() => void client.forceStop(), timeoutMs);
  const toolsCalled: AiToolCallTrace[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let toolCalls = 0;
  try {
    await client.start();
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
          try {
            return await tool.execute(parsedArgs, params.toolContext);
          } finally {
            toolsCalled.push({
              toolName: tool.name,
              args: parsedArgs,
              durationMs: Date.now() - callStarted,
            });
          }
        },
      })),
    });
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
    };
  } finally {
    clearTimeout(timer);
    await cleanup();
  }
}
