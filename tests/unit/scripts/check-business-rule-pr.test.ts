import { createRequire } from 'node:module';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireScript = createRequire(import.meta.url);
const { validateDeclaration, validateEvent, main } = requireScript(
  '../../../scripts/check-business-rule-pr.js'
);
const { load: parseYaml } = requireScript('js-yaml');
const repository = path.resolve(__dirname, '../../..');

let root: string;
const declaration = () => ({
  businessRuleChange: true,
  owner: 'Clothing payroll domain maintainer',
  invariant: 'Paid payroll cannot be edited or applied twice.',
  domains: ['clothing', 'shared'],
  policyPaths: ['docs/policy.md'],
  affectedPaths: ['src'],
  tests: {
    paths: ['tests/payroll.test.ts'],
    results: 'Passed focused payroll rollback and retry checks.',
  },
  docs: { paths: ['docs/policy.md'] },
  divergence: {
    status: 'none',
    reason:
      'Other domains retain their explicitly documented payment policies.',
  },
});
const eventFor = (record: unknown) => ({
  pull_request: {
    body: `<!-- business-rule-change -->\n\`\`\`json\n${JSON.stringify(record)}\n\`\`\`\n<!-- /business-rule-change -->`,
  },
});

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'business-rule-pr-'));
  for (const directory of ['docs', 'src', 'tests']) {
    mkdirSync(path.join(root, directory));
  }
  writeFileSync(path.join(root, 'docs/policy.md'), 'Approved policy');
  writeFileSync(
    path.join(root, 'tests/payroll.test.ts'),
    'Synthetic test reference'
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('business-rule PR contract', () => {
  it('accepts a complete business change', () => {
    expect(validateEvent(eventFor(declaration()), root)).toEqual([]);
  });
  it.each([
    'owner',
    'invariant',
    'domains',
    'policyPaths',
    'affectedPaths',
    'tests',
    'docs',
    'divergence',
  ])('rejects missing %s evidence', (field) => {
    const record = { ...declaration(), [field]: undefined };
    expect(validateEvent(eventFor(record), root).length).toBeGreaterThan(0);
  });
  it('requires an explicit classification and substantive non-business rationale', () => {
    expect(
      validateDeclaration(
        {
          businessRuleChange: false,
          rationale: 'Only formatting changes; no runtime behavior is altered.',
        },
        root
      )
    ).toEqual([]);
    for (const record of [
      {},
      { businessRuleChange: 'no' },
      { businessRuleChange: false },
      { businessRuleChange: false, rationale: 'TBD later' },
    ]) {
      expect(validateDeclaration(record, root).length).toBeGreaterThan(0);
    }
  });
  it.each([
    'docs/missing.md',
    '../outside.md',
    '/etc/passwd',
    'docs\\policy.md',
  ])('rejects missing or unsafe path %s', (reference) => {
    expect(
      validateDeclaration({ ...declaration(), policyPaths: [reference] }, root)
        .length
    ).toBeGreaterThan(0);
  });
  it('rejects symlinks outside the repository', () => {
    symlinkSync(tmpdir(), path.join(root, 'outside'));
    expect(
      validateDeclaration(
        { ...declaration(), affectedPaths: ['outside'] },
        root
      ).length
    ).toBeGreaterThan(0);
  });
  it('rejects placeholders, unsupported domains and unresolved divergence', () => {
    for (const patch of [
      { owner: '<accountable owner>' },
      { domains: ['unknown'] },
      {
        divergence: {
          status: 'unresolved',
          reason: 'Policy requires a new business decision.',
        },
      },
    ]) {
      expect(
        validateDeclaration({ ...declaration(), ...patch }, root).length
      ).toBeGreaterThan(0);
    }
  });
  it('requires approvers for intentional differences and evidence exceptions', () => {
    const record = {
      ...declaration(),
      divergence: {
        status: 'intentional',
        reason: 'Trucking uses a different approved payroll schedule.',
        approvedBy: 'Business owner decision in linked policy',
      },
      docs: {
        exception:
          'Existing linked policy already describes the unchanged contract.',
        approvedBy: 'Domain documentation maintainer',
      },
    };
    expect(validateDeclaration(record, root)).toEqual([]);
    expect(
      validateDeclaration(
        { ...record, docs: { exception: record.docs.exception } },
        root
      ).length
    ).toBeGreaterThan(0);
    expect(
      validateDeclaration(
        { ...record, divergence: { ...record.divergence, approvedBy: '' } },
        root
      ).length
    ).toBeGreaterThan(0);
  });
  it('rejects missing, duplicated and malformed JSON blocks', () => {
    const event = eventFor(declaration());
    expect(
      validateEvent({ pull_request: { body: 'No declaration' } }, root).length
    ).toBeGreaterThan(0);
    expect(
      validateEvent(
        { pull_request: { body: event.pull_request.body.repeat(2) } },
        root
      ).length
    ).toBeGreaterThan(0);
    expect(
      validateEvent(eventFor(declaration()).pull_request, root).length
    ).toBeGreaterThan(0);
    expect(
      validateEvent(
        {
          pull_request: {
            body: event.pull_request.body.replace('true', 'invalid'),
          },
        },
        root
      ).length
    ).toBeGreaterThan(0);
  });
  it('skips local/push runs but fails closed on missing PR payloads', () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(main({ GITHUB_EVENT_NAME: 'push' })).toBe(0);
    expect(main({})).toBe(0);
    expect(
      main({
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_EVENT_PATH: path.join(root, 'missing.json'),
      })
    ).toBe(1);
  });
  it('rejects incorrect evidence file types, blank results and unapproved test exceptions', () => {
    for (const patch of [
      {
        tests: {
          paths: ['docs/policy.md'],
          results: 'No behavior regression was observed.',
        },
      },
      { docs: { paths: ['tests/payroll.test.ts'] } },
      { tests: { paths: ['tests/payroll.test.ts'], results: '' } },
      {
        tests: {
          exception: 'No automated test applies to this policy-only change.',
          results: 'No tests were run because this changes documentation only.',
        },
      },
    ]) {
      expect(
        validateDeclaration({ ...declaration(), ...patch }, root).length
      ).toBeGreaterThan(0);
    }
  });
  it('returns real CLI success/failure codes for PR payloads and skips pushes', () => {
    const payloadPath = path.join(root, 'event.json');
    const script = path.join(repository, 'scripts/check-business-rule-pr.js');
    const invoke = (eventName: string) =>
      spawnSync(process.execPath, [script], {
        cwd: root,
        env: {
          ...process.env,
          GITHUB_EVENT_NAME: eventName,
          GITHUB_EVENT_PATH: payloadPath,
        },
        encoding: 'utf8',
      });
    writeFileSync(payloadPath, JSON.stringify(eventFor(declaration())));
    expect(invoke('pull_request').status).toBe(0);
    writeFileSync(payloadPath, JSON.stringify({ pull_request: { body: '' } }));
    expect(invoke('pull_request').status).toBe(1);
    expect(invoke('push').status).toBe(0);
    writeFileSync(payloadPath, '{malformed');
    expect(invoke('pull_request').status).toBe(1);
  });
  it('keeps the checked-in template fail-closed until deliberately completed', () => {
    const body = readFileSync(
      path.join(repository, '.github/pull_request_template.md'),
      'utf8'
    );
    expect(
      validateEvent({ pull_request: { body } }, repository).length
    ).toBeGreaterThan(0);
    const completed = body.replace(
      /```json\s*\n[\s\S]*?\n```/,
      `\`\`\`json\n${JSON.stringify({ businessRuleChange: false, rationale: 'Documentation formatting only; application behavior is unchanged.' })}\n\`\`\``
    );
    expect(
      validateEvent({ pull_request: { body: completed } }, repository)
    ).toEqual([]);
  });
  it('runs a distinct, read-only PR status on body edits without secrets or dependencies', () => {
    const workflow = parseYaml(
      readFileSync(
        path.join(repository, '.github/workflows/business-rule-protocol.yml'),
        'utf8'
      )
    );
    expect(workflow.on.pull_request.branches).toEqual(['main', 'develop']);
    expect(workflow.on.pull_request.types).toEqual(
      expect.arrayContaining([
        'opened',
        'synchronize',
        'reopened',
        'edited',
        'ready_for_review',
      ])
    );
    expect(workflow.on.push).toBeUndefined();
    expect(workflow.on.pull_request_target).toBeUndefined();
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.jobs.declaration.name).toBe('Business Rule Declaration');
    const commands = workflow.jobs.declaration.steps
      .filter((step: { run?: string }) => step.run)
      .map((step: { run: string }) => step.run);
    expect(commands).toEqual(['node scripts/check-business-rule-pr.js']);
    expect(JSON.stringify(workflow)).not.toMatch(/secrets\./);
    const packageJson = JSON.parse(
      readFileSync(path.join(repository, 'package.json'), 'utf8')
    );
    expect(packageJson.scripts['guardrails:check']).toContain(
      'node scripts/check-business-rule-pr.js'
    );
  });
  it('provisions and seeds an isolated database before CI integration tests', () => {
    const workflow = parseYaml(
      readFileSync(
        path.join(repository, '.github/workflows/quality-gates.yml'),
        'utf8'
      )
    );
    const { parse: parseEnvironment } = requireScript('dotenv');
    const environment = parseEnvironment(
      readFileSync(path.join(repository, '.env.test.example'), 'utf8')
    );
    const database = new URL(environment.DATABASE_URL);
    const job = workflow.jobs.quality;
    const postgres = job.services.postgres;
    expect(job.env.INTEGRATION_ENV_FILE).toBe('.env.test.example');
    expect(job.env.TEST_ENV_FILE).toBe('.env.test.example');
    expect(postgres.image).toBe('postgres:15');
    expect(postgres.env.POSTGRES_USER).toBe(database.username);
    expect(postgres.env.POSTGRES_PASSWORD).toBe(database.password);
    expect(postgres.env.POSTGRES_DB).toBe(database.pathname.slice(1));
    expect(postgres.env.POSTGRES_DB).toContain('test');
    expect(database.hostname).toBe('localhost');
    expect(postgres.ports).toContain(`${database.port}:5432`);
    expect(postgres.options).toContain('pg_isready');
    const commands = job.steps.map((step: { run?: string }) => step.run);
    const prepare = commands.indexOf('node scripts/reset-test-db.js --seed');
    const integration = commands.indexOf('npm run test:integration');
    expect(prepare).toBeGreaterThan(commands.indexOf('npm run test:unit'));
    expect(integration).toBeGreaterThan(prepare);
    expect(commands.indexOf('npm run test:hardening')).toBeGreaterThan(
      integration
    );
  });
});
