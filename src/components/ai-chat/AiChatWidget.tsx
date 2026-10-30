'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconChevronUp,
  IconLock,
  IconMessageChatbot,
  IconMinus,
  IconRefresh,
  IconSend,
  IconSparkles,
  IconTrash,
  IconX,
  IconZoomIn,
  IconZoomOut,
} from '@tabler/icons-react';
import type { AiGenerationResult } from '@/lib/ai/types';
import { AssistantMessageBody, CopyButton } from './ChatMessageContent';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  isError?: boolean;
  meta?: Pick<
    AiGenerationResult,
    | 'provider'
    | 'model'
    | 'latencyMs'
    | 'inputTokens'
    | 'outputTokens'
    | 'estimatedCostUsd'
    | 'toolsCalled'
    | 'usedFallback'
  >;
}

const STORAGE_KEY = 'ai-chat-widget-conversation-v1';
const SCOPE_STORAGE_KEY = 'ai-chat-widget-scope-v2';
const LEGACY_SCOPE_STORAGE_KEY = 'ai-chat-widget-scope-v1';
const HISTORY_TURNS_SENT = 4;
const ZOOM_STORAGE_KEY = 'ai-chat-widget-zoom-v1';
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.1;

export function resolveInitialChatScope(
  savedScope: string | null,
  legacyScope: string | null
): string {
  const scopes = ['ALL', 'clothing', 'trucking', 'general-merchandise'];
  if (savedScope && scopes.includes(savedScope)) {
    return savedScope;
  }
  if (legacyScope && legacyScope !== 'ALL' && scopes.includes(legacyScope)) {
    return legacyScope;
  }
  return 'clothing';
}

const SUGGESTIONS = [
  'How much should our cash onhand at the moment on the balance sheet. Can you check if it matches all the records and if not, find why?',
  'Are there any accounting discrepancies I should check?',
  'List customers with past due dates',
  'List customers with due dates coming',
  'Who is our oldest customer',
  'who are our top buyers?',
  'What recurring payments are coming due this week?',
];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [scope, setScope] = useState<string>('clothing');
  const [lastModelLabel, setLastModelLabel] = useState<string | null>(null);
  const [queue, setQueue] = useState<Array<{ id: string; text: string }>>([]);
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hydratedRef = useRef(false);

  // Restore conversation for this browser tab session
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed)) {
          setMessages(parsed);
          const lastMeta = [...parsed].reverse().find((m) => m.meta)?.meta;
          if (lastMeta) {
            setLastModelLabel(`${lastMeta.provider}:${lastMeta.model}`);
          }
        }
      }
      const savedScope = window.sessionStorage.getItem(SCOPE_STORAGE_KEY);
      setScope(
        resolveInitialChatScope(
          savedScope,
          window.sessionStorage.getItem(LEGACY_SCOPE_STORAGE_KEY)
        )
      );
      const savedZoom = Number(window.localStorage.getItem(ZOOM_STORAGE_KEY));
      if (savedZoom >= ZOOM_MIN && savedZoom <= ZOOM_MAX) {
        setZoom(savedZoom);
      }
    } catch {
      // Ignore storage errors
    } finally {
      hydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      window.sessionStorage.setItem(SCOPE_STORAGE_KEY, scope);
    } catch {
      // Ignore storage errors
    }
  }, [messages, scope]);

  // Auto-scroll to newest message
  useEffect(() => {
    const el = viewportRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, sending, open]);

  // Focus input when opening; close on Escape
  useEffect(() => {
    if (!open) {
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const sendMessage = useCallback(
    async (text: string, priorMessages: ChatMessage[]) => {
      const question = text.trim();
      if (!question || sending) {
        return;
      }

      const userMsg: ChatMessage = {
        id: newId(),
        role: 'user',
        content: question,
        createdAt: Date.now(),
      };
      const nextMessages = [...priorMessages, userMsg];
      setMessages(nextMessages);
      setInput('');
      setSending(true);

      // Only send up to 4 recent successful prior turns as context to keep prompts lean
      // Truncate long previous assistant markdown messages to max 600 chars to avoid prompt bloat
      const history = priorMessages
        .filter((m) => !m.isError)
        .slice(-HISTORY_TURNS_SENT)
        .map((m) => ({
          role: m.role,
          content:
            m.role === 'assistant' && m.content.length > 600
              ? `${m.content.slice(0, 600)}… [prior response summarized for brevity]`
              : m.content,
        }));

      try {
        const res = await fetch('/api/ai-assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'chat',
            question,
            history,
            ...(scope !== 'ALL' ? { businessUnit: scope } : {}),
          }),
        });
        const data = (await res.json()) as {
          generation?: AiGenerationResult;
          error?: string;
        };
        if (!res.ok || !data.generation) {
          throw new Error(data.error || 'The AI assistant did not respond.');
        }
        const g = data.generation;
        setLastModelLabel(`${g.provider}:${g.model}`);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            content: g.text || '_(No response text returned.)_',
            createdAt: Date.now(),
            meta: {
              provider: g.provider,
              model: g.model,
              latencyMs: g.latencyMs,
              inputTokens: g.inputTokens,
              outputTokens: g.outputTokens,
              estimatedCostUsd: g.estimatedCostUsd,
              toolsCalled: g.toolsCalled,
              usedFallback: g.usedFallback,
            },
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            content:
              err instanceof Error
                ? err.message
                : 'Something went wrong contacting the AI assistant.',
            createdAt: Date.now(),
            isError: true,
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [scope, sending]
  );

  // Submit from the composer: send now if idle, otherwise queue it
  const submitInput = () => {
    const text = input.trim();
    if (!text) {
      return;
    }
    if (sending) {
      setQueue((q) => [...q, { id: newId(), text }]);
      setInput('');
    } else {
      void sendMessage(text, messages);
    }
    inputRef.current?.focus();
  };

  // Drain queued messages one at a time once the AI has responded
  useEffect(() => {
    if (sending || queue.length === 0) {
      return;
    }
    const [next, ...rest] = queue;
    setQueue(rest);
    void sendMessage(next.text, messages);
  }, [sending, queue, messages, sendMessage]);

  const changeZoom = (delta: number) => {
    setZoom((z) => {
      const next =
        delta === 0
          ? 1
          : Math.min(
              ZOOM_MAX,
              Math.max(ZOOM_MIN, Math.round((z + delta) * 10) / 10)
            );
      try {
        window.localStorage.setItem(ZOOM_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const handleRetry = (errorMsgId: string) => {
    const idx = messages.findIndex((m) => m.id === errorMsgId);
    if (idx < 1) {
      return;
    }
    const failedUser = messages[idx - 1];
    if (failedUser.role !== 'user') {
      return;
    }
    // Drop the failed user turn + error, then resend
    void sendMessage(failedUser.content, messages.slice(0, idx - 1));
  };

  const handleClear = () => {
    setMessages([]);
    setQueue([]);
    setLastModelLabel(null);
  };

  const panelWidth = minimized
    ? 'min(340px, calc(100vw - 32px))'
    : expanded
      ? 'min(1520px, calc(100vw - 32px))'
      : 'min(420px, calc(100vw - 32px))';
  // Top navbar is 80px tall; subtracting 80px (header) + 16px (top gap) + 16px (bottom offset) = 112px
  const panelHeight = minimized
    ? 'auto'
    : expanded
      ? 'calc(100vh - 112px)'
      : 'min(620px, calc(100vh - 120px))';

  return (
    <>
      <style>{`
        .ai-chat-markdown { font-size: 14px; line-height: 1.55; word-break: break-word; }
        .ai-chat-markdown p { margin: 0 0 8px; }
        .ai-chat-markdown p:last-child { margin-bottom: 0; }
        .ai-chat-markdown ul, .ai-chat-markdown ol { margin: 4px 0 8px; padding-left: 20px; }
        .ai-chat-markdown li { margin: 2px 0; }
        .ai-chat-markdown h1, .ai-chat-markdown h2, .ai-chat-markdown h3, .ai-chat-markdown h4 { font-size: 14px; font-weight: 700; margin: 10px 0 6px; }
        .ai-chat-markdown code { background: #eef2ff; color: #3730a3; padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }
        .ai-chat-markdown pre { background: #0f172a; color: #e2e8f0; padding: 10px 12px; border-radius: 8px; overflow-x: auto; }
        .ai-chat-markdown pre code { background: transparent; color: inherit; padding: 0; }
        .ai-chat-markdown table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 12.5px; display: block; overflow-x: auto; }
        .ai-chat-markdown th, .ai-chat-markdown td { border: 1px solid #e2e8f0; padding: 4px 8px; text-align: left; }
        .ai-chat-markdown th { background: #f8fafc; }
        .ai-chat-markdown blockquote { border-left: 3px solid #c7d2fe; margin: 6px 0; padding-left: 10px; color: #475569; }
        .ai-chat-markdown a { color: #4f46e5; }
        @keyframes aiChatDot { 0%, 80%, 100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
        .ai-chat-dot { width: 7px; height: 7px; border-radius: 50%; background: #6366f1; display: inline-block; animation: aiChatDot 1.2s infinite ease-in-out; }
        @keyframes aiChatPop { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      {/* Floating launcher */}
      {!open && (
        <Tooltip
          label="Ask the AI Business Assistant"
          position="left"
          withArrow
        >
          <ActionIcon
            onClick={() => {
              setOpen(true);
              setMinimized(false);
            }}
            aria-label="Open AI chat"
            size={58}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'indigo', to: 'violet', deg: 135 }}
            style={{
              position: 'fixed',
              right: 24,
              bottom: 24,
              zIndex: 300,
              boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.45)',
            }}
          >
            <IconMessageChatbot size={28} />
          </ActionIcon>
        </Tooltip>
      )}

      {/* Chat window */}
      {open && (
        <Paper
          role="dialog"
          aria-label="AI Business Assistant chat"
          shadow="xl"
          radius="lg"
          withBorder
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            width: panelWidth,
            height: panelHeight,
            zIndex: 300,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'aiChatPop 160ms ease-out',
            transition: 'width 160ms ease, height 160ms ease',
          }}
        >
          {/* Header */}
          <Box
            px="md"
            py="sm"
            onClick={minimized ? () => setMinimized(false) : undefined}
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: 'white',
              cursor: minimized ? 'pointer' : 'default',
              userSelect: 'none',
            }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                <Box
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconSparkles size={18} />
                </Box>
                <div style={{ minWidth: 0 }}>
                  <Text fw={700} size="sm" lh={1.2}>
                    AI Business Assistant
                  </Text>
                  <Text size="xs" style={{ opacity: 0.85 }} truncate>
                    {minimized
                      ? 'Click to expand'
                      : (lastModelLabel ?? 'Read-only auditor')}
                  </Text>
                </div>
              </Group>
              <Group gap={4} wrap="nowrap">
                {minimized ? (
                  <>
                    <Tooltip label="Restore" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="white"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMinimized(false);
                        }}
                        aria-label="Restore chat"
                      >
                        <IconChevronUp size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Close (Esc)" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="white"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          setMinimized(false);
                        }}
                        aria-label="Close chat"
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </>
                ) : (
                  <>
                    <Tooltip label="Smaller text" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="white"
                        onClick={() => changeZoom(-ZOOM_STEP)}
                        aria-label="Decrease chat text size"
                        disabled={zoom <= ZOOM_MIN}
                      >
                        <IconZoomOut size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Reset text size" withArrow>
                      <UnstyledButton
                        onClick={() => changeZoom(0)}
                        aria-label="Reset chat text size"
                        style={{ color: 'white', fontSize: 11, minWidth: 34 }}
                      >
                        {Math.round(zoom * 100)}%
                      </UnstyledButton>
                    </Tooltip>
                    <Tooltip label="Larger text" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="white"
                        onClick={() => changeZoom(ZOOM_STEP)}
                        aria-label="Increase chat text size"
                        disabled={zoom >= ZOOM_MAX}
                      >
                        <IconZoomIn size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="New conversation" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="white"
                        onClick={handleClear}
                        aria-label="Clear conversation"
                        disabled={sending || messages.length === 0}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Minimize" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="white"
                        onClick={() => setMinimized(true)}
                        aria-label="Minimize chat"
                      >
                        <IconMinus size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={expanded ? 'Shrink' : 'Expand'} withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="white"
                        onClick={() => setExpanded((v) => !v)}
                        aria-label={expanded ? 'Shrink chat' : 'Expand chat'}
                      >
                        {expanded ? (
                          <IconArrowsMinimize size={16} />
                        ) : (
                          <IconArrowsMaximize size={16} />
                        )}
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Close (Esc)" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="white"
                        onClick={() => setOpen(false)}
                        aria-label="Close chat"
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </>
                )}
              </Group>
            </Group>
          </Box>

          {!minimized && (
            <>
              {/* Scope selector */}
              <Group
                px="md"
                py={6}
                justify="space-between"
                style={{
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                }}
              >
                <Text size="xs" c="dimmed" fw={500}>
                  Business scope
                </Text>
                <Select
                  size="xs"
                  w={210}
                  allowDeselect={false}
                  comboboxProps={{ zIndex: 400 }}
                  data={[
                    { value: 'ALL', label: 'All my businesses' },
                    { value: 'clothing', label: 'Clothing' },
                    { value: 'trucking', label: 'Trucking' },
                    {
                      value: 'general-merchandise',
                      label: 'General Merchandise',
                    },
                  ]}
                  value={scope}
                  onChange={(v) => setScope(v || 'clothing')}
                />
              </Group>

              {/* Messages */}
              <ScrollArea
                viewportRef={viewportRef}
                style={{ flex: 1, background: '#f8fafc' }}
                type="auto"
              >
                <Stack gap="md" p="md" style={{ zoom }}>
                  {messages.length === 0 && (
                    <Stack gap="sm" align="center" py="lg">
                      <Box
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 16,
                          background: '#eef2ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#4f46e5',
                        }}
                      >
                        <IconMessageChatbot size={28} />
                      </Box>
                      <Text fw={600} size="sm">
                        How can I help with your business today?
                      </Text>
                      <Text size="xs" c="dimmed" ta="center" maw={310}>
                        Ask me anything about your books, cash reconciliation,
                        customers, orders, inventory, or schedules — I&apos;ll
                        check the live database (strictly read-only).
                      </Text>
                      <Stack gap={6} w="100%" mt="xs">
                        {SUGGESTIONS.map((s) => (
                          <UnstyledButton
                            key={s}
                            onClick={() => void sendMessage(s, messages)}
                            style={{
                              border: '1px solid #e0e7ff',
                              background: 'white',
                              borderRadius: 10,
                              padding: '8px 12px',
                              fontSize: 13,
                              color: '#3730a3',
                              textAlign: 'left',
                            }}
                          >
                            {s}
                          </UnstyledButton>
                        ))}
                      </Stack>
                    </Stack>
                  )}

                  {messages.map((m) => {
                    const isUser = m.role === 'user';
                    return (
                      <Stack
                        key={m.id}
                        gap={4}
                        align={isUser ? 'flex-end' : 'flex-start'}
                      >
                        <Box
                          style={{
                            maxWidth: '88%',
                            padding: '9px 13px',
                            borderRadius: isUser
                              ? '14px 14px 4px 14px'
                              : '14px 14px 14px 4px',
                            background: isUser
                              ? '#4f46e5'
                              : m.isError
                                ? '#fef2f2'
                                : 'white',
                            color: isUser
                              ? 'white'
                              : m.isError
                                ? '#991b1b'
                                : '#0f172a',
                            border: isUser
                              ? 'none'
                              : m.isError
                                ? '1px solid #fecaca'
                                : '1px solid #e2e8f0',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          }}
                        >
                          {isUser ? (
                            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                              {m.content}
                            </Text>
                          ) : m.isError ? (
                            <Text size="sm">{m.content}</Text>
                          ) : (
                            <AssistantMessageBody content={m.content} />
                          )}
                        </Box>

                        <Group gap={6} px={4} wrap="wrap">
                          <Text size="10px" c="dimmed">
                            {formatTime(m.createdAt)}
                          </Text>
                          {m.meta && (
                            <>
                              <Text size="10px" c="dimmed">
                                · {(m.meta.latencyMs / 1000).toFixed(1)}s ·{' '}
                                {m.meta.inputTokens + m.meta.outputTokens}{' '}
                                tokens
                                {m.meta.estimatedCostUsd > 0
                                  ? ` · $${m.meta.estimatedCostUsd.toFixed(4)}`
                                  : ''}
                              </Text>
                              {m.meta.usedFallback && (
                                <Badge size="xs" color="orange" variant="light">
                                  fallback
                                </Badge>
                              )}
                            </>
                          )}
                          {!isUser && !m.isError && (
                            <CopyButton text={m.content} />
                          )}
                          {m.isError && (
                            <Tooltip label="Retry" withArrow>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                color="red"
                                aria-label="Retry message"
                                onClick={() => handleRetry(m.id)}
                                disabled={sending}
                              >
                                <IconRefresh size={12} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Stack>
                    );
                  })}

                  {sending && (
                    <Group gap={6} px={4}>
                      <Box
                        style={{
                          background: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '14px 14px 14px 4px',
                          padding: '10px 14px',
                          display: 'flex',
                          gap: 5,
                        }}
                      >
                        <span className="ai-chat-dot" />
                        <span
                          className="ai-chat-dot"
                          style={{ animationDelay: '0.15s' }}
                        />
                        <span
                          className="ai-chat-dot"
                          style={{ animationDelay: '0.3s' }}
                        />
                      </Box>
                      <Text size="xs" c="dimmed">
                        Checking your records…
                      </Text>
                    </Group>
                  )}

                  {queue.map((q) => (
                    <Stack key={q.id} gap={4} align="flex-end">
                      <Box
                        style={{
                          maxWidth: '88%',
                          padding: '9px 13px',
                          borderRadius: '14px 14px 4px 14px',
                          background: '#e0e7ff',
                          color: '#3730a3',
                          border: '1px dashed #818cf8',
                        }}
                      >
                        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                          {q.text}
                        </Text>
                      </Box>
                      <Group gap={6} px={4}>
                        <Text size="10px" c="dimmed">
                          Queued — sends after the current reply
                        </Text>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="gray"
                          aria-label="Remove queued message"
                          onClick={() =>
                            setQueue((prev) =>
                              prev.filter((item) => item.id !== q.id)
                            )
                          }
                        >
                          <IconX size={12} />
                        </ActionIcon>
                      </Group>
                    </Stack>
                  ))}
                </Stack>
              </ScrollArea>

              {/* Composer */}
              <Box
                p="sm"
                style={{ borderTop: '1px solid #e2e8f0', background: 'white' }}
              >
                <Group gap="xs" align="flex-end" wrap="nowrap">
                  <Textarea
                    ref={inputRef}
                    style={{ flex: 1 }}
                    styles={{
                      input: {
                        fontSize: `calc(var(--mantine-font-size-sm) * ${zoom})`,
                      },
                    }}
                    placeholder="Ask about invoices, payments, schedules…"
                    autosize
                    minRows={1}
                    maxRows={5}
                    value={input}
                    onChange={(e) => setInput(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        submitInput();
                      }
                    }}
                  />
                  <ActionIcon
                    size={36}
                    radius="md"
                    variant="filled"
                    color="indigo"
                    aria-label={sending ? 'Queue message' : 'Send message'}
                    disabled={!input.trim()}
                    onClick={submitInput}
                  >
                    {sending && !input.trim() ? (
                      <Loader size={16} color="white" />
                    ) : (
                      <IconSend size={18} />
                    )}
                  </ActionIcon>
                </Group>
                <Group gap={4} mt={6} justify="center">
                  <IconLock size={11} color="#94a3b8" />
                  <Text size="10px" c="dimmed">
                    Read-only · Enter to send, Shift+Enter for new line · Verify
                    figures before acting
                  </Text>
                </Group>
              </Box>
            </>
          )}
        </Paper>
      )}
    </>
  );
}

export default AiChatWidget;
