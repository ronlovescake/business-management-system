#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const BACKUP_DIR = process.env.BACKUP_DIR || '/backups';
const ENV_FILE = process.env.ENV_FILE || '/app/.env.docker';
const POLL_MS = Math.max(
  2000,
  Number(process.env.RESTORE_RUNNER_POLL_MS || 5000)
);
const RUNNER_COMPOSE_FILE = '/app/docker-compose.yml';
const RUNNER_ENV_FILE = '/app/.env.docker';

const jobsDirectory = path.join(BACKUP_DIR, '_restore-jobs');
const statusFilePath = path.join(jobsDirectory, 'status.json');
const heartbeatFilePath = path.join(jobsDirectory, 'heartbeat.json');
const JOBS_DIRECTORY_MODE = 0o777;
const JOBS_FILE_MODE = 0o666;

let running = false;
let inspectedContainer;

function inspectCurrentContainer() {
  if (inspectedContainer !== undefined) {
    return inspectedContainer;
  }

  const containerId = process.env.HOSTNAME;
  if (!containerId) {
    inspectedContainer = null;
    return inspectedContainer;
  }

  try {
    const inspectOutput = execFileSync('docker', ['inspect', containerId], {
      encoding: 'utf8',
    });
    const [containerInfo] = JSON.parse(inspectOutput);
    inspectedContainer = containerInfo ?? null;
  } catch (error) {
    console.error('[restore-runner] Failed to inspect runner container:', error);
    inspectedContainer = null;
  }

  return inspectedContainer;
}

function resolveComposeProjectName() {
  if (process.env.COMPOSE_PROJECT_NAME) {
    return process.env.COMPOSE_PROJECT_NAME;
  }

  return (
    inspectCurrentContainer()?.Config?.Labels?.['com.docker.compose.project'] ||
    ''
  );
}

function resolveMountedSource(destination) {
  const mounts = inspectCurrentContainer()?.Mounts;
  if (!Array.isArray(mounts)) {
    return '';
  }

  const mount = mounts.find((entry) => entry?.Destination === destination);
  return typeof mount?.Source === 'string' ? mount.Source : '';
}

const composeProjectName = resolveComposeProjectName();
const composeFilePath =
  process.env.COMPOSE_FILE_PATH || resolveMountedSource(RUNNER_COMPOSE_FILE);
const composeEnvFile =
  process.env.COMPOSE_ENV_FILE || resolveMountedSource(RUNNER_ENV_FILE);

function ensureJobsDirectory() {
  if (!fs.existsSync(jobsDirectory)) {
    fs.mkdirSync(jobsDirectory, {
      recursive: true,
      mode: JOBS_DIRECTORY_MODE,
    });
  }

  try {
    fs.chmodSync(jobsDirectory, JOBS_DIRECTORY_MODE);
  } catch (error) {
    console.warn(
      '[restore-runner] Failed to normalize restore jobs directory permissions:',
      error
    );
  }
}

function readStatus() {
  if (!fs.existsSync(statusFilePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));
  } catch (error) {
    console.error('[restore-runner] Failed to parse status file:', error);
    return null;
  }
}

function writeJsonAtomic(filePath, value) {
  ensureJobsDirectory();
  const tempFilePath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempFilePath, JSON.stringify(value, null, 2), {
    mode: JOBS_FILE_MODE,
  });
  fs.renameSync(tempFilePath, filePath);

  try {
    fs.chmodSync(filePath, JOBS_FILE_MODE);
  } catch (error) {
    console.warn(
      '[restore-runner] Failed to normalize restore state file permissions:',
      error
    );
  }
}

function writeStatus(status) {
  writeJsonAtomic(statusFilePath, {
    ...status,
    updatedAt: new Date().toISOString(),
  });
}

function writeHeartbeat() {
  writeJsonAtomic(heartbeatFilePath, {
    service: 'restore-runner',
    version: 1,
    updatedAt: new Date().toISOString(),
  });
}

function markStaleRunningJobAsFailed() {
  const status = readStatus();
  if (!status || status.phase !== 'running') {
    return;
  }

  writeStatus({
    ...status,
    phase: 'failed',
    finishedAt: new Date().toISOString(),
    error:
      'Restore runner restarted while a restore job was marked as running. Review the database before retrying.',
    message: 'Restore job marked as failed after runner restart.',
  });
}

function executeRestore(status) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'bash',
      [
        'scripts/docker/restore-dump-into-docker.sh',
        status.dumpArtifactPath,
        '--confirm',
      ],
      {
        cwd: '/app',
        env: {
          ...process.env,
          ENV_FILE,
          ...(composeFilePath ? { COMPOSE_FILE_PATH: composeFilePath } : {}),
          ...(composeEnvFile ? { COMPOSE_ENV_FILE: composeEnvFile } : {}),
          ...(composeProjectName
            ? { COMPOSE_PROJECT_NAME: composeProjectName }
            : {}),
        },
      }
    );

    let output = '';

    const appendOutput = (chunk) => {
      output += chunk.toString();
      if (output.length > 12000) {
        output = output.slice(-12000);
      }
    };

    child.stdout.on('data', appendOutput);
    child.stderr.on('data', appendOutput);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
        return;
      }

      reject(
        new Error(output || `Restore command failed with exit code ${code}`)
      );
    });
  });
}

async function tick() {
  writeHeartbeat();

  if (running) {
    return;
  }

  const status = readStatus();
  if (!status || status.phase !== 'pending') {
    return;
  }

  running = true;

  writeStatus({
    ...status,
    phase: 'running',
    startedAt: new Date().toISOString(),
    message:
      'Restore runner started the validated full-dump restore. The app will be unavailable until the restore completes.',
    error: undefined,
  });

  try {
    await executeRestore(status);
    writeStatus({
      ...status,
      phase: 'succeeded',
      startedAt: status.startedAt || new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      message: 'Restore completed successfully and the app was started again.',
      error: undefined,
    });
  } catch (error) {
    writeStatus({
      ...status,
      phase: 'failed',
      startedAt: status.startedAt || new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      message: 'Restore failed. Review the error before retrying.',
      error: error instanceof Error ? error.message : 'Restore command failed',
    });
  } finally {
    running = false;
  }
}

ensureJobsDirectory();
markStaleRunningJobAsFailed();
writeHeartbeat();

console.log(
  `[restore-runner] Watching ${statusFilePath} every ${POLL_MS}ms for pending restore jobs.`
);

if (composeProjectName) {
  console.log(`[restore-runner] Using compose project: ${composeProjectName}`);
}

if (composeFilePath) {
  console.log(`[restore-runner] Using host compose file: ${composeFilePath}`);
}

if (composeEnvFile) {
  console.log(`[restore-runner] Using host env file: ${composeEnvFile}`);
}

void tick();
setInterval(() => {
  void tick();
}, POLL_MS);
