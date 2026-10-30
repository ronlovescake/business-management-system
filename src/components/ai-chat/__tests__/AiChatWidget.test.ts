import React from 'react';
import { MantineProvider } from '@mantine/core';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveInitialChatScope } from '../AiChatWidget';
import { AiChatHeader } from '../AiChatHeader';

describe('chat business scope defaults', () => {
  afterEach(cleanup);
  it('preserves extracted header labels and zoom/close controls', () => {
    const changeZoom = vi.fn();
    const setOpen = vi.fn();
    render(
      React.createElement(
        MantineProvider,
        null,
        React.createElement(AiChatHeader, {
          minimized: false,
          setMinimized: vi.fn(),
          lastModelLabel: 'copilot:test',
          setOpen,
          changeZoom,
          zoom: 1,
          handleClear: vi.fn(),
          sending: false,
          messageCount: 1,
          expanded: false,
          setExpanded: vi.fn(),
        })
      )
    );
    expect(document.body.textContent).toContain('AI Business Assistant');
    expect(document.body.textContent).toContain('copilot:test');
    document
      .querySelector<HTMLButtonElement>(
        '[aria-label="Increase chat text size"]'
      )
      ?.click();
    expect(changeZoom).toHaveBeenCalledWith(0.1);
    document
      .querySelector<HTMLButtonElement>('[aria-label="Close chat"]')
      ?.click();
    expect(setOpen).toHaveBeenCalledWith(false);
  });
  it('defaults to Clothing for new sessions and legacy All selections', () => {
    expect(resolveInitialChatScope(null, null)).toBe('clothing');
    expect(resolveInitialChatScope(null, 'ALL')).toBe('clothing');
    expect(resolveInitialChatScope('invalid', 'ALL')).toBe('clothing');
  });
  it('preserves explicit business scopes and future All selections', () => {
    expect(resolveInitialChatScope(null, 'trucking')).toBe('trucking');
    expect(resolveInitialChatScope(null, 'general-merchandise')).toBe(
      'general-merchandise'
    );
    expect(resolveInitialChatScope('ALL', 'clothing')).toBe('ALL');
  });
});
