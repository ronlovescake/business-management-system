import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerateWithProviderParams } from '../providers';
import { access } from 'node:fs/promises';

const sdk = vi.hoisted(() => ({
  options: vi.fn(),
  start: vi.fn(),
  createSession: vi.fn(),
  listModels: vi.fn(),
  forceStop: vi.fn(),
  sendAndWait: vi.fn(),
  on: vi.fn(),
}));

vi.mock('@github/copilot-sdk', () => ({
  CopilotClient: class {
    constructor(options: unknown) {
      sdk.options(options);
    }
    createSession = sdk.createSession;
    start = sdk.start;
    listModels = sdk.listModels;
    forceStop = sdk.forceStop;
  },
}));

import {
  discoverProviderModels,
  generateWithProvider,
  testProviderConnection,
} from '../providers';

const params: GenerateWithProviderParams = {
  provider: 'copilot',
  model: 'auto',
  systemPrompt: 'Read-only business assistant',
  userPrompt: 'Show overdue invoices',
  history: [{ role: 'assistant', content: 'Previous answer' }],
  tools: [],
  toolContext: {
    userId: 'owner',
    userRole: 'ADMIN',
    accessibleModules: [],
    allowedBusinessUnits: ['clothing'],
  },
};

describe('Copilot provider isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('COPILOT_GITHUB_TOKEN', 'test-token');
    vi.stubEnv('COPILOT_ALLOWED_USER_ID', 'owner');
    sdk.forceStop.mockResolvedValue(undefined);
    sdk.start.mockResolvedValue(undefined);
    sdk.createSession.mockImplementation(async (config) => {
      if (config.gitHubToken !== 'test-token') {
        throw new Error('Session was not created with authentication info');
      }
      return { on: sdk.on, sendAndWait: sdk.sendAndWait };
    });
    sdk.sendAndWait.mockResolvedValue({ data: { content: 'Verified answer' } });
    sdk.listModels.mockResolvedValue([{ id: 'model-one' }]);
    sdk.on.mockImplementation((name, handler) => {
      if (name === 'assistant.usage') {
        handler({ data: { inputTokens: 20, outputTokens: 10 } });
      }
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses explicit authentication and disables inherited capabilities', async () => {
    const result = await generateWithProvider(params);
    expect(sdk.options).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'empty',
        gitHubToken: 'test-token',
        useLoggedInUser: false,
        env: expect.not.objectContaining({ DATABASE_URL: expect.anything() }),
      })
    );
    const config = sdk.createSession.mock.calls[0][0];
    expect(config).toMatchObject({
      gitHubToken: 'test-token',
      availableTools: [],
      excludedTools: ['builtin:*', 'mcp:*'],
      enableConfigDiscovery: false,
      enableSkills: false,
      enableFileHooks: false,
      enableHostGitOperations: false,
      enableSessionStore: false,
      memory: { enabled: false },
    });
    expect(config.onPermissionRequest({ kind: 'shell' })).toEqual({
      kind: 'reject',
    });
    expect(sdk.sendAndWait.mock.calls[0][0].prompt).toContain(
      'Previous answer'
    );
    expect(result).toMatchObject({
      provider: 'copilot',
      text: 'Verified answer',
      inputTokens: 20,
      outputTokens: 10,
      estimatedCostUsd: 0,
    });
    expect(sdk.forceStop).toHaveBeenCalled();
    await expect(
      access(sdk.options.mock.calls[0][0].baseDirectory)
    ).rejects.toThrow();
  });

  it('executes only registered tools using the original RBAC context', async () => {
    const execute = vi.fn().mockResolvedValue({ balance: 200 });
    sdk.sendAndWait.mockImplementationOnce(async () => {
      const config = sdk.createSession.mock.calls[0][0];
      expect(config.availableTools).toEqual(['custom:lookup']);
      await config.tools[0].handler({ businessUnit: 'clothing' });
      return { data: { content: 'Balance: 200' } };
    });
    const result = await generateWithProvider({
      ...params,
      tools: [
        {
          name: 'lookup',
          description: 'Read-only lookup',
          readOnly: true,
          businessUnits: ['clothing'],
          parameters: { type: 'object', properties: {} },
          execute,
        },
      ],
    });
    expect(execute).toHaveBeenCalledWith(
      { businessUnit: 'clothing' },
      params.toolContext
    );
    expect(result.toolsCalled[0].toolName).toBe('lookup');
  });

  it('rejects other users and unattended requests before starting the SDK', async () => {
    for (const userId of ['other-user', null]) {
      await expect(
        generateWithProvider({
          ...params,
          toolContext: { ...params.toolContext, userId },
        })
      ).rejects.toThrow(/COPILOT_ALLOWED_USER_ID/);
    }
    expect(sdk.options).not.toHaveBeenCalled();
  });

  it('fails clearly when the server token is missing', async () => {
    vi.stubEnv('COPILOT_GITHUB_TOKEN', '');
    await expect(generateWithProvider(params)).rejects.toThrow(
      /COPILOT_GITHUB_TOKEN/
    );
    expect(sdk.options).not.toHaveBeenCalled();
  });

  it('stops the runtime after provider errors', async () => {
    sdk.sendAndWait.mockRejectedValueOnce(new Error('Quota exhausted'));
    await expect(generateWithProvider(params)).rejects.toThrow(
      'Quota exhausted'
    );
    expect(sdk.forceStop).toHaveBeenCalled();
  });

  it('discovers entitled models through the SDK', async () => {
    expect(await discoverProviderModels('copilot')).toEqual([
      'auto',
      'model-one',
    ]);
    expect(sdk.forceStop).toHaveBeenCalled();
  });

  it('allows the fixed synthetic connection test without an app-user binding', async () => {
    vi.stubEnv('COPILOT_ALLOWED_USER_ID', '');
    expect(
      await testProviderConnection({ provider: 'copilot', model: 'auto' })
    ).toMatchObject({ ok: true });
  });

  it('stops timed-out work and removes temporary state', async () => {
    sdk.sendAndWait.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          sdk.forceStop.mockImplementationOnce(async () => {
            reject(new Error('Stopped'));
          });
        })
    );
    await expect(
      generateWithProvider({ ...params, timeoutMs: 20 })
    ).rejects.toThrow('Stopped');
    await expect(
      access(sdk.options.mock.calls[0][0].baseDirectory)
    ).rejects.toThrow();
  });
});
