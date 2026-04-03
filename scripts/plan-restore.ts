import {
  planRestoreChain,
  type RestorePlan,
  type RestorePlanStep,
} from '@/lib/backup/restorePlanner';

type ParsedArgs = {
  folder?: string;
  timestamp?: string;
  json?: boolean;
};

function printUsage() {
  console.error(
    [
      'Usage: npm run restore:plan -- --folder <backup-folder>',
      '   or: npm run restore:plan -- --timestamp <backup-timestamp>',
      '',
      'Optional flags:',
      '  --json    Print the restore plan as JSON',
    ].join('\n')
  );
}

function parseArgs(argv: string[]) {
  const parsed: ParsedArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--folder' && next) {
      parsed.folder = next;
      index += 1;
      continue;
    }

    if (arg === '--timestamp' && next) {
      parsed.timestamp = next;
      index += 1;
      continue;
    }

    if (arg === '--json') {
      parsed.json = true;
    }
  }

  return parsed;
}

function formatStep(step: RestorePlanStep, index: number) {
  const support = step.supported ? 'ready' : 'planned-only';
  const artifact = step.artifactName ? ` (${step.artifactName})` : '';
  const reason = step.reason ? `\n     note: ${step.reason}` : '';

  return `${index + 1}. ${step.action} [${support}] ${step.folder}${artifact}${reason}`;
}

function printHumanPlan(plan: RestorePlan) {
  console.log(`Restore plan status: ${plan.status}`);
  console.log(`Target backup: ${plan.targetFolder} (${plan.targetStrategy})`);
  console.log(`Chain folders: ${plan.chainFolders.join(' -> ')}`);
  console.log('');
  console.log('Planned steps:');
  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    if (step) {
      console.log(formatStep(step, index));
    }
  }

  if (plan.warnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    for (const warning of plan.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (plan.errors.length > 0) {
    console.log('');
    console.log('Errors:');
    for (const error of plan.errors) {
      console.log(`- ${error}`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.folder && !args.timestamp) {
    printUsage();
    process.exit(1);
  }

  const plan = planRestoreChain({
    folder: args.folder,
    timestamp: args.timestamp,
  });

  if (args.json) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    printHumanPlan(plan);
  }

  process.exit(plan.status === 'invalid' ? 1 : 0);
}

main();
