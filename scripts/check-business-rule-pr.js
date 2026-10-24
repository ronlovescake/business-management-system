const fs = require('node:fs');
const path = require('node:path');

const DOMAINS = new Set([
  'clothing',
  'general-merchandise',
  'trucking',
  'household-finance',
  'platform',
  'shared',
]);

function meaningful(value) {
  return (
    typeof value === 'string' &&
    value.trim().length >= 10 &&
    !/\b(?:todo|tbd|fixme|replace me|fill in)\b|<[^>]+>/i.test(value) &&
    !/^(?:n\/?a|none|pending|yes|no)[.!\s]*$/i.test(value.trim())
  );
}

function validateDeclaration(record, root = process.cwd()) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return ['The business-rule declaration must be a JSON object.'];
  }
  if (typeof record.businessRuleChange !== 'boolean') {
    return ['businessRuleChange must be true or false.'];
  }
  if (!record.businessRuleChange) {
    return meaningful(record.rationale)
      ? []
      : ['A non-business change needs a substantive rationale.'];
  }

  for (const field of ['owner', 'invariant']) {
    if (!meaningful(record[field])) {
      errors.push(`${field} needs a substantive answer without placeholders.`);
    }
  }
  if (
    !Array.isArray(record.domains) ||
    !record.domains.length ||
    record.domains.some((domain) => !DOMAINS.has(domain))
  ) {
    errors.push(
      `domains must contain one or more of: ${[...DOMAINS].join(', ')}.`
    );
  }

  const realRoot = fs.realpathSync(root);
  function validatePaths(values, field, kind) {
    if (!Array.isArray(values) || !values.length) {
      errors.push(`${field} must list existing repository paths.`);
      return;
    }
    for (const value of values) {
      try {
        if (
          typeof value !== 'string' ||
          !value.trim() ||
          value.includes('\\') ||
          path.isAbsolute(value) ||
          value.split('/').includes('..')
        ) {
          throw new Error('Use repository-relative paths without traversal.');
        }
        const resolved = fs.realpathSync(path.resolve(realRoot, value));
        const relative = path.relative(realRoot, resolved);
        if (
          !relative ||
          relative.startsWith('..') ||
          path.isAbsolute(relative)
        ) {
          throw new Error('Path must stay inside the repository.');
        }
        if (kind !== 'affected' && !fs.statSync(resolved).isFile()) {
          throw new Error('Evidence must refer to a file.');
        }
        if (kind === 'docs' && !/\.md$/i.test(value)) {
          throw new Error('Policy/documentation evidence must be Markdown.');
        }
        if (kind === 'tests' && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(value)) {
          throw new Error('Test evidence must identify a test/spec file.');
        }
      } catch (error) {
        errors.push(
          `${field}: invalid path ${JSON.stringify(value)} (${error.message}).`
        );
      }
    }
  }

  validatePaths(record.policyPaths, 'policyPaths', 'docs');
  validatePaths(record.affectedPaths, 'affectedPaths', 'affected');
  for (const field of ['tests', 'docs']) {
    const evidence = record[field];
    if (evidence?.exception) {
      if (!meaningful(evidence.exception) || !meaningful(evidence.approvedBy)) {
        errors.push(
          `${field} exception requires a rationale and accountable approver.`
        );
      }
    } else {
      validatePaths(evidence?.paths, `${field}.paths`, field);
    }
    if (field === 'tests' && !meaningful(evidence?.results)) {
      errors.push(
        'tests.results must state actual checks/results or explain why none ran.'
      );
    }
  }
  const divergence = record.divergence;
  if (!['none', 'intentional'].includes(divergence?.status)) {
    errors.push(
      'divergence.status must be none or intentional; resolve policy questions before merge.'
    );
  }
  if (!meaningful(divergence?.reason)) {
    errors.push(
      'divergence.reason must explain the parallel-domain impact or intentional difference.'
    );
  }
  if (
    divergence?.status === 'intentional' &&
    !meaningful(divergence.approvedBy)
  ) {
    errors.push('Intentional divergence requires an accountable approver.');
  }
  return errors;
}

function validateEvent(event, root) {
  const body = event?.pull_request?.body;
  if (typeof body !== 'string') {
    return ['PR body is missing the business-rule declaration.'];
  }
  const blocks = [
    ...body.matchAll(
      /<!-- business-rule-change -->\s*```json\s*\n([\s\S]*?)\n```\s*<!-- \/business-rule-change -->/g
    ),
  ];
  if (
    blocks.length !== 1 ||
    (body.match(/<!-- business-rule-change -->/g) || []).length !== 1
  ) {
    return [
      'Include exactly one marked business-rule JSON block from the PR template.',
    ];
  }
  try {
    return validateDeclaration(JSON.parse(blocks[0][1]), root);
  } catch {
    return ['The business-rule declaration must contain valid JSON.'];
  }
}

function main(environment = process.env) {
  if (environment.GITHUB_EVENT_NAME !== 'pull_request') {
    process.stdout.write(
      '[business-rule-pr] Skipped: not a pull_request event.\n'
    );
    return 0;
  }
  let errors;
  try {
    const event = JSON.parse(
      fs.readFileSync(environment.GITHUB_EVENT_PATH, 'utf8')
    );
    errors = validateEvent(event, process.cwd());
  } catch {
    errors = [
      'Unable to read the pull_request event payload; refusing to skip validation.',
    ];
  }
  if (errors.length) {
    process.stderr.write(
      `[business-rule-pr] Failed:\n${errors.map((error) => `- ${error}`).join('\n')}\n`
    );
    return 1;
  }
  process.stdout.write(
    '[business-rule-pr] Declaration complete; semantic review is still required.\n'
  );
  return 0;
}

module.exports = { validateDeclaration, validateEvent, main };
if (require.main === module) {
  process.exitCode = main();
}
