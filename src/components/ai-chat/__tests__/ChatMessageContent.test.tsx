import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AssistantMessageBody } from '../ChatMessageContent';

describe('Assistant message content', () => {
  afterEach(cleanup);

  it('preserves Markdown formatting and safe record links', () => {
    const container = document.body;
    render(
      <AssistantMessageBody
        content={
          '**Verified balance**\n\n[Orders](/clothing/operations/transactions)'
        }
      />
    );

    expect(container.querySelector('strong')?.textContent).toBe(
      'Verified balance'
    );
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      '/clothing/operations/transactions'
    );
    expect(container.querySelector('.ai-chat-markdown')).not.toBeNull();
  });

  it('removes scripts, event handlers, unsafe URLs, and disallowed tags', () => {
    const container = document.body;
    render(
      <AssistantMessageBody
        content={
          '<script>alert(1)</script><p onclick="alert(1)">Balance</p>' +
          '<a href="javascript:alert(1)">Unsafe link</a>' +
          '<img src="x" onerror="alert(1)"><iframe src="/private"></iframe>'
        }
      />
    );

    expect(
      container.querySelector('script, img, iframe, [onclick], [onerror]')
    ).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBeNull();
    expect(container.textContent).toContain('Balance');
  });
});
