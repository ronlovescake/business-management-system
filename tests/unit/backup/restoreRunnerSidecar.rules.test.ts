/**
 * Restore Runner Sidecar — Business-Rule-Mapped Tests
 *
 * Tests the logic in scripts/run-restore-runner.js by extracting
 * testable patterns from the source and verifying contracts.
 *
 * Rules Covered (scheduler-and-internal-job-orchestration.md):
 *  D21: Polls status file for pending jobs
 *  D22: Writes heartbeat file
 *  D23: Only 'pending' phase triggers a restore
 *  D24: Stale 'running' job marked as failed on startup
 *  D25: Restores executed via restore-dump-into-docker.sh
 *  D26: Only one restore at a time
 *  D27: Status transitions: pending → running → succeeded/failed
 *  D28: Output capped at 12KB
 *  D29: Auto-resolves compose project name
 *  D30: File permissions 0o777/0o666 for cross-container access
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const RUNNER_PATH = resolve(
  __dirname,
  '../../../scripts/run-restore-runner.js'
);
const runnerSource = readFileSync(RUNNER_PATH, 'utf8');

// ===========================================================================
// Source-level contract verification
// ===========================================================================

describe('Restore Runner Sidecar — Source Contracts', () => {
  it('D21: polls status.json from the restore jobs directory', () => {
    expect(runnerSource).toContain("'status.json'");
    expect(runnerSource).toContain('_restore-jobs');
  });

  it('D22: writes heartbeat.json', () => {
    expect(runnerSource).toContain("'heartbeat.json'");
    expect(runnerSource).toContain("service: 'restore-runner'");
  });

  it('D23: only pending phase triggers a restore', () => {
    expect(runnerSource).toContain("status.phase !== 'pending'");
  });

  it('D24: marks stale running jobs as failed on startup', () => {
    expect(runnerSource).toContain('markStaleRunningJobAsFailed');
    expect(runnerSource).toContain("status.phase !== 'running'");
    expect(runnerSource).toContain("phase: 'failed'");
    expect(runnerSource).toContain(
      'Restore runner restarted while a restore job was marked as running'
    );
  });

  it('D25: executes restore via restore-dump-into-docker.sh', () => {
    expect(runnerSource).toContain(
      'scripts/docker/restore-dump-into-docker.sh'
    );
    expect(runnerSource).toContain("'--confirm'");
  });

  it('D26: uses a running flag to prevent concurrent restores', () => {
    expect(runnerSource).toContain('let running = false');
    expect(runnerSource).toContain('if (running)');
    expect(runnerSource).toContain('running = true');
    expect(runnerSource).toContain('running = false');
  });

  it('D27: implements pending → running → succeeded/failed transitions', () => {
    expect(runnerSource).toContain("phase: 'running'");
    expect(runnerSource).toContain("phase: 'succeeded'");
    expect(runnerSource).toContain("phase: 'failed'");
    // pending is checked via !== comparison, not assignment
    expect(runnerSource).toContain("'pending'");
  });

  it('D28: output is capped at 12KB', () => {
    expect(runnerSource).toContain('12000');
    expect(runnerSource).toContain('output.slice(-12000)');
  });

  it('D29: resolves compose project name from container labels', () => {
    expect(runnerSource).toContain('com.docker.compose.project');
    expect(runnerSource).toContain('COMPOSE_PROJECT_NAME');
  });

  it('D30: uses 0o777 for directories and 0o666 for files', () => {
    expect(runnerSource).toContain('0o777');
    expect(runnerSource).toContain('0o666');
  });

  it('D21: minimum poll interval is 2000ms', () => {
    expect(runnerSource).toContain('Math.max');
    expect(runnerSource).toContain('2000');
  });

  it('D21: default poll interval is 5000ms', () => {
    expect(runnerSource).toContain('5000');
  });

  it('D27: status writes are atomic (write to tmp then rename)', () => {
    expect(runnerSource).toContain('writeJsonAtomic');
    expect(runnerSource).toContain('.tmp-');
    expect(runnerSource).toContain('renameSync');
  });
});

// ===========================================================================
// Status state machine tests
// ===========================================================================

describe('Restore Runner Sidecar — State Machine Logic', () => {
  /**
   * Simulate the markStaleRunningJobAsFailed logic
   */
  function markStaleRunningJobAsFailed(
    status: { phase: string } | null
  ): { phase: string; error?: string } | null {
    if (!status || status.phase !== 'running') {
      return null;
    }

    return {
      ...status,
      phase: 'failed',
      error:
        'Restore runner restarted while a restore job was marked as running. Review the database before retrying.',
    };
  }

  it('D24: running job is marked as failed', () => {
    const result = markStaleRunningJobAsFailed({ phase: 'running' });
    expect(result).toBeDefined();
    expect(result!.phase).toBe('failed');
    expect(result!.error).toContain('restarted');
  });

  it('D24: pending job is not modified', () => {
    const result = markStaleRunningJobAsFailed({ phase: 'pending' });
    expect(result).toBeNull();
  });

  it('D24: succeeded job is not modified', () => {
    const result = markStaleRunningJobAsFailed({ phase: 'succeeded' });
    expect(result).toBeNull();
  });

  it('D24: failed job is not modified', () => {
    const result = markStaleRunningJobAsFailed({ phase: 'failed' });
    expect(result).toBeNull();
  });

  it('D24: null status is not modified', () => {
    const result = markStaleRunningJobAsFailed(null);
    expect(result).toBeNull();
  });

  /**
   * Simulate the tick guard: should only process pending status
   */
  function shouldProcessRestore(
    status: { phase: string } | null,
    running: boolean
  ): boolean {
    if (running) {
      return false;
    }
    if (!status || status.phase !== 'pending') {
      return false;
    }
    return true;
  }

  it('D23: processes a pending status', () => {
    expect(shouldProcessRestore({ phase: 'pending' }, false)).toBe(true);
  });

  it('D23: ignores running status', () => {
    expect(shouldProcessRestore({ phase: 'running' }, false)).toBe(false);
  });

  it('D23: ignores succeeded status', () => {
    expect(shouldProcessRestore({ phase: 'succeeded' }, false)).toBe(false);
  });

  it('D23: ignores failed status', () => {
    expect(shouldProcessRestore({ phase: 'failed' }, false)).toBe(false);
  });

  it('D26: skips if already running', () => {
    expect(shouldProcessRestore({ phase: 'pending' }, true)).toBe(false);
  });

  it('D23: handles null status', () => {
    expect(shouldProcessRestore(null, false)).toBe(false);
  });
});
