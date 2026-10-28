import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseHandbook } from './parseHandbook';

export const HANDBOOK_SOURCE =
  'docs/business-logic/clothing/operations-workflow.md';

export async function loadHandbook() {
  const markdown = await readFile(
    path.join(process.cwd(), HANDBOOK_SOURCE),
    'utf8'
  );
  return parseHandbook(markdown);
}
