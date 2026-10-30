'use client';
import React, { type Dispatch, type SetStateAction } from 'react';
import {
  ActionIcon,
  Box,
  Group,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconChevronUp,
  IconMinus,
  IconSparkles,
  IconTrash,
  IconX,
  IconZoomIn,
  IconZoomOut,
} from '@tabler/icons-react';
export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 1.6;
export const ZOOM_STEP = 0.1;
interface HeaderProps {
  minimized: boolean;
  setMinimized: Dispatch<SetStateAction<boolean>>;
  lastModelLabel: string | null;
  setOpen: Dispatch<SetStateAction<boolean>>;
  changeZoom: (step: number) => void;
  zoom: number;
  handleClear: () => void;
  sending: boolean;
  messageCount: number;
  expanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
}
export function AiChatHeader({
  minimized,
  setMinimized,
  lastModelLabel,
  setOpen,
  changeZoom,
  zoom,
  handleClear,
  sending,
  messageCount,
  expanded,
  setExpanded,
}: HeaderProps) {
  return (
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
                  disabled={sending || messageCount === 0}
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
  );
}
