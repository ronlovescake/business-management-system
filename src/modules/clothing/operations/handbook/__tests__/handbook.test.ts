import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHandbook } from '../parseHandbook';
import { HANDBOOK_MODULES, searchHandbook } from '../handbook';
import { HANDBOOK_SOURCE, loadHandbook } from '../loadHandbook.server';

const source = `# Employee handbook

Internal introduction is not published.

<!-- handbook: {"id":"S01","modules":["products"],"kind":"workflow"} -->

## **Register Products**

Check the supplier purchase.

### Payment proof

1. Reopen the saved purchase.
2. Read [E01](#e01-missing-goods).

## Developer maintenance

This must not appear in employee procedures.

<!-- handbook: {"id":"E01","modules":["products","inventory"],"kind":"issue"} -->

### E01: Missing Goods

Keep the supplier message. Do not invent stock.
`;

describe('employee handbook content', () => {
  it('loads the single canonical source and includes it in both runtime packaging paths', async () => {
    expect(await loadHandbook()).toHaveLength(74);
    const nextConfig = readFileSync(
      path.join(process.cwd(), 'next.config.js'),
      'utf8'
    );
    const dockerfile = readFileSync(
      path.join(process.cwd(), 'Dockerfile'),
      'utf8'
    );
    expect(nextConfig).toContain(
      "serverComponentsExternalPackages: ['isomorphic-dompurify']"
    );
    expect(nextConfig).toContain(
      `'/clothing/operations/handbook': [\n        '${HANDBOOK_SOURCE}',`
    );
    expect(dockerfile).toContain(
      `/app/${HANDBOOK_SOURCE} ./${HANDBOOK_SOURCE}`
    );
  });

  it('covers every approved module and all canonical workflows, issues and FAQs', () => {
    const markdown = readFileSync(
      path.join(
        process.cwd(),
        'docs/business-logic/clothing/operations-workflow.md'
      ),
      'utf8'
    );
    const procedures = parseHandbook(markdown);
    expect(procedures.filter((item) => item.kind === 'workflow')).toHaveLength(
      12
    );
    expect(procedures.filter((item) => item.kind === 'issue')).toHaveLength(22);
    expect(procedures.filter((item) => item.id.startsWith('F'))).toHaveLength(
      27
    );
    expect(
      procedures.filter((item) => item.kind === 'accounting')
    ).toHaveLength(10);
    for (const handbookModule of HANDBOOK_MODULES) {
      expect(
        procedures.some((item) => item.modules.includes(handbookModule.id))
      ).toBe(true);
    }
    for (const procedure of procedures) {
      const element = document.createElement('div');
      element.innerHTML = procedure.html;
      for (const link of Array.from(element.querySelectorAll('a'))) {
        expect(
          procedures.some((item) => `#${item.id}` === link.getAttribute('href'))
        ).toBe(true);
      }
    }
    expect(procedures.find((item) => item.id === 'S03')?.html).toContain(
      'Reservation Deposit Terminology And Allocation'
    );
    expect(procedures.find((item) => item.id === 'E19')?.html).toContain(
      'Known expense-history defects remain unresolved'
    );
    expect(procedures.find((item) => item.id === 'A02')?.html).toContain(
      'Known\nsettlement-date and deletion defects remain unresolved'
    );
    expect(JSON.stringify(procedures)).not.toContain(
      'Source Of Truth And Maintenance'
    );
  });

  it('uses explicit metadata and preserves nested employee instructions only', () => {
    const procedures = parseHandbook(source);
    expect(procedures.map((procedure) => procedure.id)).toEqual(['S01', 'E01']);
    expect(procedures[0].title).toBe('Register Products');
    expect(procedures[0].html).toContain('<h3>Payment proof</h3>');
    expect(procedures[0].html).toContain('<a href="#E01">E01</a>');
    expect(procedures[0].html).not.toContain('Developer maintenance');
    expect(JSON.stringify(procedures)).not.toContain('Internal introduction');
  });

  it('searches procedure text and module names with all query terms', () => {
    const procedures = parseHandbook(source);
    expect(
      searchHandbook(procedures, '  INVENTORY supplier  ').map(
        (item) => item.id
      )
    ).toEqual(['E01']);
    expect(searchHandbook(procedures, 'purchase', 'products')).toHaveLength(1);
    expect(searchHandbook(procedures, 'purchase', 'inventory')).toHaveLength(0);
    expect(searchHandbook(procedures, '')).toHaveLength(2);
  });

  it('rejects duplicate IDs, invalid modules, missing headings and empty procedures', () => {
    expect(() => parseHandbook(source.replace('"E01"', '"S01"'))).toThrow(
      'Duplicate'
    );
    expect(() =>
      parseHandbook(source.replace('"products"', '"employees"'))
    ).toThrow();
    expect(() =>
      parseHandbook(source.replace('## **Register Products**', 'Not a heading'))
    ).toThrow('must precede a heading');
    expect(() =>
      parseHandbook(
        source.replace('Keep the supplier message. Do not invent stock.', '')
      )
    ).toThrow('Empty handbook procedure');
    expect(() =>
      parseHandbook(source.replace('#e01-missing-goods', '#no-such-procedure'))
    ).toThrow('Unknown handbook link');
  });

  it('removes active HTML and does not expose internal documents or unsafe links', () => {
    const [procedure] = parseHandbook(
      source.replace(
        'Check the supplier purchase.',
        `<script>alert(1)</script>
<img src=x onerror="alert(1)">
<p style="color:red" onclick="alert(1)">Safe text</p>
<a href="/private-contract.md">Private document</a>

[Unsafe](javascript:alert%281%29) and [contract](operations-products.md).
`
      )
    );
    expect(procedure.html).toContain('Safe text');
    expect(procedure.html).not.toMatch(
      /script|onerror|onclick|style=|javascript:|operations-products\.md|href="\/private/
    );
  });
});
