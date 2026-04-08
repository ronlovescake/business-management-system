import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveVitestEnvFile } from '../resolveVitestEnvFile';

describe('resolveVitestEnvFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the preferred env file when it exists', () => {
    const preferredPath = path.resolve(process.cwd(), '.env.test');

    vi.spyOn(fs, 'existsSync').mockImplementation((candidate) => {
      return String(candidate) === preferredPath;
    });

    expect(resolveVitestEnvFile('.env.test')).toBe(preferredPath);
  });

  it('falls back to .env.test.example when .env.test is absent', () => {
    const examplePath = path.resolve(process.cwd(), '.env.test.example');

    vi.spyOn(fs, 'existsSync').mockImplementation((candidate) => {
      return String(candidate) === examplePath;
    });

    expect(resolveVitestEnvFile('.env.test')).toBe(examplePath);
  });

  it('returns the preferred path unchanged for non-default files', () => {
    const customPath = path.resolve(process.cwd(), '.env.custom-tests');

    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(resolveVitestEnvFile('.env.custom-tests')).toBe(customPath);
  });
});