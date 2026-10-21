#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');

const GIB = 1024 ** 3;

function getAvailableBytes(targetPath) {
  const stats = fs.statfsSync(targetPath);
  return stats.bavail * stats.bsize;
}

function main() {
  const minimumFreeGiB = Number(
    process.env.BMS_DOCKER_BUILD_MIN_FREE_GB ?? '15'
  );

  if (!Number.isFinite(minimumFreeGiB) || minimumFreeGiB <= 0) {
    throw new Error('BMS_DOCKER_BUILD_MIN_FREE_GB must be a positive number.');
  }

  const dockerRoot = execFileSync(
    'docker',
    ['info', '--format', '{{.DockerRootDir}}'],
    { encoding: 'utf8' }
  ).trim();

  if (!dockerRoot) {
    throw new Error('Docker did not report its data root directory.');
  }

  const targets = [
    { label: 'Docker data root', path: dockerRoot },
    { label: 'temporary directory', path: os.tmpdir() },
  ];
  const minimumFreeBytes = minimumFreeGiB * GIB;
  const blocked = [];

  for (const target of targets) {
    const availableBytes = getAvailableBytes(target.path);
    const availableGiB = availableBytes / GIB;
    const status = availableBytes < minimumFreeBytes ? 'LOW' : 'OK';

    console.log(
      `[docker:build-space] ${status} ${target.label} (${target.path}): ` +
        `${availableGiB.toFixed(1)} GiB free; ${minimumFreeGiB} GiB required.`
    );

    if (availableBytes < minimumFreeBytes) {
      blocked.push(target.label);
    }
  }

  if (blocked.length > 0) {
    console.error(
      `[docker:build-space] Build stopped: insufficient space on ${blocked.join(', ')}.`
    );
    console.error(
      'Review usage with `docker system df` and `df -h`; prune only data you have reviewed.'
    );
    process.exitCode = 1;
    return;
  }

  console.log('[docker:build-space] Space check passed.');
}

try {
  main();
} catch (error) {
  console.error(
    `[docker:build-space] Could not verify build space: ${error.message}`
  );
  process.exitCode = 1;
}
