import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const requireScript = createRequire(import.meta.url);
const repository = path.resolve(__dirname, '../../..');
const source = readFileSync(
  path.join(repository, 'scripts/reset-test-db.js'),
  'utf8'
);

function invoke(databaseUrl?: string, seed = false, failBootstrap = false) {
  const environment: Record<string, string | undefined> = {
    TEST_ENV_FILE: '.env.ci.test',
    DATABASE_URL: 'postgresql://ignored:ignored@localhost/production',
  };
  const execute = vi.fn((_command: string, _options: unknown) => {
    if (failBootstrap) {
      throw Object.assign(new Error('bootstrap failed'), { status: 2 });
    }
  });
  const configure = vi.fn(() => {
    environment.DATABASE_URL = databaseUrl;
  });
  let failure: unknown;
  try {
    runInNewContext(source, {
      require: (specifier: string) => {
        if (specifier === 'child_process') {
          return { execSync: execute };
        }
        if (specifier === 'dotenv') {
          return { config: configure };
        }
        return requireScript(specifier);
      },
      process: {
        env: environment,
        argv: ['node', 'reset-test-db.js', ...(seed ? ['--seed'] : [])],
        cwd: () => repository,
        exit: (status: number) => {
          throw new Error(`exit ${status}`);
        },
      },
      console: { log: vi.fn(), error: vi.fn() },
      __dirname: path.join(repository, 'scripts'),
      URL,
    });
  } catch (error) {
    failure = error;
  }
  return { execute, configure, failure };
}

describe('test database bootstrap', () => {
  it.each([
    undefined,
    'invalid-url',
    'postgresql://user:pass@localhost/production',
  ])(
    'refuses unsafe target %s before running database commands',
    (databaseUrl) => {
      const result = invoke(databaseUrl);
      expect(String(result.failure)).toContain('exit 1');
      expect(result.execute).not.toHaveBeenCalled();
    }
  );

  it('bootstraps the custom sequence before schema alignment and optional seed', () => {
    const databaseUrl =
      'postgresql://test:test@localhost:5433/business_ci_test';
    const result = invoke(databaseUrl, true);
    expect(result.failure).toBeUndefined();
    expect(result.configure).toHaveBeenCalledWith({
      path: path.join(repository, '.env.ci.test'),
      override: true,
    });
    const commands = result.execute.mock.calls.map(([command]) => command);
    expect(commands[0]).toContain('db execute --stdin');
    expect(commands[1]).toContain('db push --schema');
    expect(commands[1]).not.toContain('--force-reset');
    expect(commands[2]).toContain('20261018120000_order_customer_identity');
    expect(commands[3]).toContain(
      '20261019100000_link_gm_customers_to_clothing'
    );
    for (const [offset, definition] of [
      [4, 'CREATE FUNCTION public.resolve_clothing_product_identity()'],
      [5, 'CREATE FUNCTION general_merchandise.resolve_product_identity()'],
      [6, 'ADD CONSTRAINT transactions_initial_deposit_nonnegative'],
    ] as const) {
      expect(commands[offset]).toContain('db execute --stdin');
      const triggerOptions = result.execute.mock.calls[offset][1] as {
        input: string;
      };
      expect(triggerOptions.input).toContain(definition);
      expect(triggerOptions.input).not.toContain('CREATE TABLE');
      expect(triggerOptions.input).toMatch(/^BEGIN;[\s\S]*COMMIT;\s*$/);
    }
    const lifecycleRules = (
      result.execute.mock.calls[6][1] as { input: string }
    ).input;
    for (const constraint of [
      'transactions_initial_deposit_nonnegative',
      'transactions_initial_deposit_rate_valid',
      'clothing_order_cancellations_kind_check',
      'clothing_cancellation_amounts_valid',
      'clothing_refund_payouts_amount_check',
    ]) {
      expect(lifecycleRules).toContain(`ADD CONSTRAINT ${constraint}`);
    }
    expect(lifecycleRules).not.toContain('ADD COLUMN');
    expect(commands[7]).toContain(
      'db execute --file prisma/migrations/20261027160000_clothing_transaction_product_clear/migration.sql'
    );
    expect(commands[8]).toContain('db seed');
    const options = result.execute.mock.calls[0][1] as {
      input: string;
      env: { DATABASE_URL: string };
    };
    expect(options.env.DATABASE_URL).toBe(databaseUrl);
    expect(options.input).toContain(
      'CREATE SEQUENCE public."ClothingInvestorCodeSequence"'
    );
    expect(options.input).toContain(
      'DROP SCHEMA IF EXISTS general_merchandise CASCADE'
    );
    expect(options.input).toMatch(/^BEGIN;[\s\S]*COMMIT;$/);
  });

  it('does not seed unless requested', () => {
    const result = invoke(
      'postgresql://test:test@localhost:5433/business_ci_test'
    );
    expect(result.failure).toBeUndefined();
    expect(result.execute).toHaveBeenCalledTimes(8);
    expect(
      result.execute.mock.calls.some(([command]) => command.includes('db seed'))
    ).toBe(false);
  });

  it('stops after a failed bootstrap without aligning or seeding', () => {
    const result = invoke(
      'postgresql://test:test@localhost:5433/business_ci_test',
      true,
      true
    );
    expect(String(result.failure)).toContain('exit 2');
    expect(result.execute).toHaveBeenCalledTimes(1);
  });
});
