import { describe, expect, it } from 'vitest';
import { parseCSVLine } from '../csvUtils';

describe('csvUtils.parseCSVLine', () => {
  it('parses simple comma-separated values', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('keeps commas inside quoted fields', () => {
    expect(parseCSVLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('handles escaped quotes inside quoted fields', () => {
    expect(parseCSVLine('a,"b""c",d')).toEqual(['a', 'b"c', 'd']);
  });

  it('trims whitespace around unquoted fields', () => {
    expect(parseCSVLine(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });
});
