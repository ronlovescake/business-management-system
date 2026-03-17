'use client';

import type { FocusEvent, ReactNode, RefObject } from 'react';
import { Button, FileInput, Group, Stack, TextInput } from '@mantine/core';
import { IconSearch, IconUpload } from '@tabler/icons-react';

interface HandsontableGridToolbarProps {
  searchQuery: string;
  onSearch: (query: string) => void;
  searchPlaceholder: string;
  enableCtrlF: boolean;
  searchInputRef: RefObject<HTMLInputElement>;
  onSearchFocus: (event: FocusEvent<HTMLInputElement>) => void;
  enableCSVImport: boolean;
  csvFile: File | null;
  onFileChange: (file: File | null) => void;
  onCSVImport: () => void;
  actionButtons?: ReactNode;
  secondarySearchControl?: ReactNode;
  searchRightButtons?: ReactNode;
  searchBottomContent?: ReactNode;
  stackActionsBelowSearch: boolean;
}

export function HandsontableGridToolbar({
  searchQuery,
  onSearch,
  searchPlaceholder,
  enableCtrlF,
  searchInputRef,
  onSearchFocus,
  enableCSVImport,
  csvFile,
  onFileChange,
  onCSVImport,
  actionButtons,
  secondarySearchControl,
  searchRightButtons,
  searchBottomContent,
  stackActionsBelowSearch,
}: HandsontableGridToolbarProps) {
  if (stackActionsBelowSearch) {
    return (
      <Stack gap="md">
        <Group align="flex-end" wrap="wrap" gap="md">
          <Group gap="md" style={{ flex: 1, minWidth: 0 }}>
            <TextInput
              ref={searchInputRef}
              placeholder={
                enableCtrlF
                  ? `${searchPlaceholder} (Ctrl+F)`
                  : searchPlaceholder
              }
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(event) => onSearch(event.target.value)}
              onFocus={onSearchFocus}
              style={{ flex: 1, minWidth: 300 }}
              styles={{
                input: {
                  backgroundColor: '#ffffff',
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  color: '#333333',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  '&::placeholder': {
                    color: '#999999',
                  },
                  '&:focus': {
                    borderColor: '#667eea',
                    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)',
                  },
                },
              }}
              size="md"
              radius="md"
            />
            {searchRightButtons}
          </Group>
        </Group>

        {enableCSVImport || actionButtons ? (
          <Group justify="flex-end" gap="sm" wrap="wrap">
            {enableCSVImport ? (
              <>
                <FileInput
                  placeholder="Select CSV file"
                  leftSection={<IconUpload size={16} />}
                  value={csvFile}
                  onChange={onFileChange}
                  accept=".csv"
                  size="md"
                  radius="md"
                />
                <Button
                  onClick={onCSVImport}
                  disabled={!csvFile}
                  size="md"
                  radius="md"
                >
                  Import
                </Button>
              </>
            ) : null}
            {actionButtons}
          </Group>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      <Group justify="flex-start" align="flex-start" wrap="nowrap" gap="md">
        <Group
          gap="md"
          align="flex-start"
          wrap="nowrap"
          style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}
        >
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <TextInput
              ref={searchInputRef}
              placeholder={
                enableCtrlF
                  ? `${searchPlaceholder} (Ctrl+F)`
                  : searchPlaceholder
              }
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(event) => onSearch(event.target.value)}
              onFocus={onSearchFocus}
              style={{ width: '100%', minWidth: 0 }}
              size="md"
              radius="md"
            />
          </div>

          {secondarySearchControl ? (
            <>
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                {secondarySearchControl}
              </div>
              {searchRightButtons ? (
                <div
                  style={{
                    flex: '0 0 auto',
                    minWidth: 'max-content',
                    display: 'flex',
                    alignItems: 'center',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {searchRightButtons}
                </div>
              ) : null}
            </>
          ) : (
            searchRightButtons
          )}
        </Group>

        {enableCSVImport || actionButtons ? (
          <Group
            gap="sm"
            wrap="nowrap"
            style={{ flexShrink: 0, marginLeft: 'auto' }}
          >
            {enableCSVImport ? (
              <>
                <FileInput
                  placeholder="Select CSV file"
                  leftSection={<IconUpload size={16} />}
                  value={csvFile}
                  onChange={onFileChange}
                  accept=".csv"
                  size="md"
                  radius="md"
                />
                <Button
                  onClick={onCSVImport}
                  disabled={!csvFile}
                  size="md"
                  radius="md"
                >
                  Import
                </Button>
              </>
            ) : null}
            {actionButtons}
          </Group>
        ) : null}
      </Group>

      {searchBottomContent}
    </Stack>
  );
}
