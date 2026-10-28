import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { fireEvent, screen, waitFor, within } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { HandbookPage } from '../HandbookPage';
import { parseHandbook } from '../parseHandbook';

const procedures = parseHandbook(`
<!-- handbook: {"id":"START","modules":["getting-started"],"kind":"reference"} -->

### Before You Start

Sign in with your own account. See [E01](#e01-missing-stock).

<!-- handbook: {"id":"E01","modules":["inventory"],"kind":"issue"} -->

### E01: Missing Stock

Recount the goods before recording a supplier shortage.

<!-- handbook: {"id":"A01","modules":["ledger"],"kind":"accounting"} -->

### Read Closing Balance

Ask an authorized administrator to review brought forward and period movement.
`);

function renderPage() {
  return render(
    <MantineProvider>
      <HandbookPage procedures={procedures} />
    </MantineProvider>
  );
}

describe('HandbookPage', () => {
  beforeEach(() => {
    vi.stubGlobal('React', React);
    window.history.replaceState(null, '', '/clothing/operations/handbook');
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });

  it('searches full procedure text, filters modules and recovers from empty results', () => {
    renderPage();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search handbook' }), {
      target: { value: 'supplier shortage' },
    });
    expect(
      screen.getByRole('heading', { name: 'E01: Missing Stock' })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#E01');
    const modules = screen.getByRole('navigation', {
      name: 'Handbook modules',
    });
    fireEvent.click(within(modules).getByRole('button', { name: /Ledger/ }));
    expect(
      screen.getByRole('heading', { name: 'No matching procedures' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(
      screen.getByRole('heading', { name: 'Before You Start' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Search handbook' })
    ).toHaveValue('');
    fireEvent.click(within(modules).getByRole('button', { name: /Ledger/ }));
    expect(window.location.hash).toBe('#A01');
  });

  it('follows related procedures, updates stable links and handles browser history', async () => {
    renderPage();
    const article = screen.getByRole('region', { name: 'Selected procedure' });
    fireEvent.click(within(article).getByRole('link', { name: 'E01' }));
    expect(
      screen.getByRole('heading', { name: 'E01: Missing Stock' })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('#E01');
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'E01: Missing Stock' })
      ).toHaveFocus()
    );
    window.history.replaceState(null, '', '#A01');
    fireEvent(window, new PopStateEvent('popstate'));
    expect(
      screen.getByRole('heading', { name: 'Read Closing Balance' })
    ).toBeInTheDocument();
  });

  it('opens a shared procedure link and gives a usable fallback for unknown IDs', () => {
    window.history.replaceState(null, '', '#A01');
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Read Closing Balance' })
    ).toBeInTheDocument();
    window.history.replaceState(null, '', '#REMOVED');
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(
      screen.getByText('That procedure link is not in this handbook.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Search handbook' })
    ).toBeInTheDocument();
  });

  it('selects a procedure from the mobile browse drawer', async () => {
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Browse modules & issues' })
    );
    const drawer = await screen.findByRole('dialog', {
      name: 'Browse Handbook',
    });
    fireEvent.click(
      within(drawer).getByRole('link', { name: /E01: Missing Stock/ })
    );
    expect(
      screen.getByRole('heading', { name: 'E01: Missing Stock' })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('copies a procedure-specific link and reports clipboard failure', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy procedure link' })
    );
    await screen.findByText('Link copied');
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('/clothing/operations/handbook#START')
    );
    writeText.mockRejectedValueOnce(new Error('Clipboard unavailable'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy procedure link' })
    );
    await screen.findByText('Could not copy link');
  });
});
