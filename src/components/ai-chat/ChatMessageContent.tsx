'use client';

import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'code',
    'pre',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'blockquote',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'a',
    'hr',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
};

function renderMarkdown(text: string): string {
  const html = marked.parse(text, { breaks: true, gfm: true }) as string;
  return String(DOMPurify.sanitize(html, SANITIZE_CONFIG));
}

export function AssistantMessageBody({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return (
    <div
      className="ai-chat-markdown"
      // Content is sanitized with DOMPurify using a strict allowlist above.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow>
      <ActionIcon
        size="xs"
        variant="subtle"
        color="gray"
        aria-label="Copy message"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          } catch {
            // Clipboard may be unavailable over plain-HTTP LAN origins
          }
        }}
      >
        {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
      </ActionIcon>
    </Tooltip>
  );
}
