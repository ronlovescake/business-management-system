import { describe, expect, it } from 'vitest';

const {
  parseEnvFile,
  readEnvValue,
} = require('../../../scripts/docker/read-env-value.js');

describe('read-env-value', () => {
  it('parses plain, quoted, and exported env values without dotenv', () => {
    const parsed = parseEnvFile(`
# comment
PLAIN=value
export SPACED = "hello world"
SINGLE='keep # hash'
DOUBLE="line\\nnext"
INLINE=value # comment
`);

    expect(parsed.PLAIN).toBe('value');
    expect(parsed.SPACED).toBe('hello world');
    expect(parsed.SINGLE).toBe('keep # hash');
    expect(parsed.DOUBLE).toBe('line\nnext');
    expect(parsed.INLINE).toBe('value');
  });

  it('returns an empty string when the env file is missing', () => {
    expect(readEnvValue('/tmp/does-not-exist.env', 'POSTGRES_DB')).toBe('');
  });
});
