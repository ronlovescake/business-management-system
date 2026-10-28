'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  Flex,
  Group,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  TypographyStylesProvider,
  UnstyledButton,
} from '@mantine/core';
import {
  IconBook2,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconLink,
  IconList,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  HANDBOOK_MODULES,
  searchHandbook,
  type HandbookModuleId,
  type HandbookProcedure,
} from './handbook';

const kindLabels = {
  workflow: 'Workflow',
  issue: 'Issue',
  reference: 'Quick Reference',
  accounting: 'Accounting Guide',
};

export function HandbookPage({
  procedures,
}: {
  procedures: HandbookProcedure[];
}) {
  const [query, setQuery] = useState('');
  const [moduleId, setModuleId] = useState<HandbookModuleId>();
  const [selectedId, setSelectedId] = useState<string | undefined>(
    procedures[0]?.id
  );
  const [browseOpened, setBrowseOpened] = useState(false);
  const [unknownLink, setUnknownLink] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const results = searchHandbook(procedures, query, moduleId);
  const selected = results.find((item) => item.id === selectedId) ?? results[0];
  const selectedIndex = selected ? results.indexOf(selected) : -1;
  const selectedModule = HANDBOOK_MODULES.find((item) => item.id === moduleId);
  const allMatches = searchHandbook(procedures, query);

  useEffect(() => {
    function readLocation() {
      const id = window.location.hash.slice(1);
      if (!id) {
        setSelectedId(procedures[0]?.id);
        setUnknownLink(false);
        return;
      }
      const exists = procedures.some((item) => item.id === id);
      setUnknownLink(!exists);
      if (exists) {
        setSelectedId(id);
        setModuleId(undefined);
        setQuery('');
      }
    }
    readLocation();
    window.addEventListener('hashchange', readLocation);
    window.addEventListener('popstate', readLocation);
    return () => {
      window.removeEventListener('hashchange', readLocation);
      window.removeEventListener('popstate', readLocation);
    };
  }, [procedures]);

  function selectProcedure(id: string, reveal = false) {
    setSelectedId(id);
    setUnknownLink(false);
    setCopyStatus('');
    setBrowseOpened(false);
    if (reveal) {
      setModuleId(undefined);
      setQuery('');
    }
    if (window.location.hash !== `#${id}`) {
      window.history.pushState(null, '', `#${id}`);
    }
    window.requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
      headingRef.current?.scrollIntoView({ block: 'start' });
    });
  }

  function selectModule(value: string | null) {
    const selectedModuleOption = HANDBOOK_MODULES.find(
      (item) => item.id === value
    );
    updateFilters(query, selectedModuleOption?.id);
  }

  function updateFilters(nextQuery: string, nextModuleId?: HandbookModuleId) {
    const matches = searchHandbook(procedures, nextQuery, nextModuleId);
    const nextSelected =
      matches.find((item) => item.id === selected?.id) ?? matches[0];
    setQuery(nextQuery);
    setModuleId(nextModuleId);
    setSelectedId(nextSelected?.id);
    setUnknownLink(false);
    setCopyStatus('');
    if (nextSelected) {
      window.history.replaceState(null, '', `#${nextSelected.id}`);
    }
  }

  async function copyLink() {
    if (!selected) {
      return;
    }
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${window.location.pathname}#${selected.id}`
      );
      setCopyStatus('Link copied');
    } catch {
      setCopyStatus('Could not copy link');
    }
  }

  function clearFilters() {
    updateFilters('');
  }

  const procedureNavigation = (
    <Stack gap="sm">
      <Select
        hiddenFrom="lg"
        label="Module"
        aria-label="Handbook module"
        value={moduleId ?? 'all'}
        onChange={selectModule}
        allowDeselect={false}
        searchable
        data={[
          { value: 'all', label: 'All modules' },
          ...(['Operations', 'Accounting'] as const).map((group) => ({
            group,
            items: HANDBOOK_MODULES.filter((item) => item.group === group).map(
              (item) => ({ value: item.id, label: item.label })
            ),
          })),
        ]}
      />
      <Group justify="space-between" align="start" wrap="nowrap" gap="xs">
        <Text fw={600} size="sm" style={{ overflowWrap: 'anywhere' }}>
          {selectedModule?.label ?? 'All Procedures'}
        </Text>
        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
          {results.length}
        </Text>
      </Group>
      <ScrollArea.Autosize
        mah="calc(100dvh - 310px)"
        type="auto"
        offsetScrollbars
      >
        <Stack component="nav" aria-label="Handbook procedures" gap={4}>
          {results.map((procedure) => (
            <UnstyledButton
              key={procedure.id}
              component="a"
              href={`#${procedure.id}`}
              aria-current={selected?.id === procedure.id ? 'page' : undefined}
              onClick={(event) => {
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return;
                }
                event.preventDefault();
                selectProcedure(procedure.id);
              }}
              px="sm"
              py="xs"
              style={{
                display: 'block',
                borderRadius: 4,
                borderLeft: `3px solid ${selected?.id === procedure.id ? 'var(--mantine-color-teal-6)' : 'transparent'}`,
                background:
                  selected?.id === procedure.id
                    ? 'var(--mantine-color-teal-light)'
                    : undefined,
              }}
            >
              <Text
                component="span"
                size="xs"
                c="dimmed"
                display="block"
                mb={3}
              >
                {procedure.id} · {kindLabels[procedure.kind]}
              </Text>
              <Text
                component="span"
                size="sm"
                fw={selected?.id === procedure.id ? 600 : 400}
              >
                {procedure.title}
              </Text>
            </UnstyledButton>
          ))}
          {!results.length && (
            <Text size="sm" c="dimmed">
              No matching procedures.
            </Text>
          )}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );

  return (
    <PageLayout fluid>
      <Stack gap="lg">
        <Group align="center" gap="sm">
          <IconBook2
            size={28}
            color="var(--mantine-color-teal-7)"
            aria-hidden="true"
          />
          <Box style={{ minWidth: 0 }}>
            <Title order={1} size="h2">
              Employee Handbook
            </Title>
            <Text size="sm" c="dimmed">
              Czarlie &amp; Ron Clothing
            </Text>
          </Box>
        </Group>
        <TextInput
          aria-label="Search handbook"
          placeholder="Search procedures, issues or codes"
          value={query}
          onChange={(event) =>
            updateFilters(event.currentTarget.value, moduleId)
          }
          leftSection={<IconSearch size={18} aria-hidden="true" />}
          rightSection={
            query ? (
              <Tooltip label="Clear search">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label="Clear search"
                  onClick={() => updateFilters('', moduleId)}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Tooltip>
            ) : null
          }
        />
        <Group justify="space-between" gap="xs">
          <Text
            size="sm"
            c="dimmed"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {results.length} {results.length === 1 ? 'procedure' : 'procedures'}
            {selectedModule ? ` in ${selectedModule.label}` : ''}
          </Text>
          <Button
            hiddenFrom="sm"
            variant="light"
            color="teal"
            size="xs"
            leftSection={<IconList size={16} />}
            onClick={() => setBrowseOpened(true)}
          >
            Browse modules &amp; issues
          </Button>
        </Group>
        {unknownLink && (
          <Alert
            color="yellow"
            title="Procedure unavailable"
            withCloseButton
            onClose={() => setUnknownLink(false)}
          >
            That procedure link is not in this handbook.
          </Alert>
        )}
        <Flex gap="lg" align="flex-start">
          <Box
            component="nav"
            aria-label="Handbook modules"
            w={208}
            visibleFrom="lg"
            style={{ flexShrink: 0, position: 'sticky', top: 88 }}
          >
            <ScrollArea.Autosize
              mah="calc(100dvh - 280px)"
              type="auto"
              offsetScrollbars
            >
              <Stack gap={4}>
                <UnstyledButton
                  onClick={() => selectModule('all')}
                  px="sm"
                  py="xs"
                  aria-pressed={!moduleId}
                  style={{
                    borderRadius: 4,
                    background: !moduleId
                      ? 'var(--mantine-color-gray-light)'
                      : undefined,
                  }}
                >
                  <Text size="sm" fw={600}>
                    All Modules
                  </Text>
                </UnstyledButton>
                {(['Operations', 'Accounting'] as const).map((group) => (
                  <Stack key={group} gap={2} mt="sm">
                    <Text size="xs" fw={700} c="dimmed" px="sm" mb={4}>
                      {group}
                    </Text>
                    {HANDBOOK_MODULES.filter(
                      (module) => module.group === group
                    ).map((module) => (
                      <UnstyledButton
                        key={module.id}
                        px="sm"
                        py={7}
                        onClick={() => selectModule(module.id)}
                        aria-pressed={moduleId === module.id}
                        style={{
                          borderRadius: 4,
                          background:
                            moduleId === module.id
                              ? 'var(--mantine-color-teal-light)'
                              : undefined,
                        }}
                      >
                        <Group
                          justify="space-between"
                          wrap="nowrap"
                          gap="xs"
                          align="start"
                        >
                          <Text
                            size="sm"
                            fw={moduleId === module.id ? 600 : 400}
                          >
                            {module.label}
                          </Text>
                          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                            {
                              allMatches.filter((item) =>
                                item.modules.includes(module.id)
                              ).length
                            }
                          </Text>
                        </Group>
                      </UnstyledButton>
                    ))}
                  </Stack>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          </Box>
          <Box
            w={{ sm: 236, lg: 280 }}
            visibleFrom="sm"
            style={{ flexShrink: 0, position: 'sticky', top: 88 }}
          >
            {procedureNavigation}
          </Box>
          <Box
            component="section"
            aria-label="Selected procedure"
            style={{ flex: 1, minWidth: 0 }}
          >
            {selected ? (
              <Stack component="article" gap="md">
                <Group
                  justify="space-between"
                  align="start"
                  wrap="nowrap"
                  gap="sm"
                >
                  <Box style={{ minWidth: 0 }}>
                    <Text size="xs" fw={600} c="teal" mb={6}>
                      {selected.id} · {kindLabels[selected.kind]}
                    </Text>
                    <Title
                      order={2}
                      size="h3"
                      ref={headingRef}
                      tabIndex={-1}
                      style={{ overflowWrap: 'anywhere', scrollMarginTop: 96 }}
                    >
                      {selected.title}
                    </Title>
                  </Box>
                  <Tooltip label={copyStatus || 'Copy procedure link'}>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="lg"
                      aria-label="Copy procedure link"
                      onClick={copyLink}
                    >
                      {copyStatus === 'Link copied' ? (
                        <IconCheck size={18} />
                      ) : (
                        <IconLink size={18} />
                      )}
                    </ActionIcon>
                  </Tooltip>
                </Group>
                {copyStatus && (
                  <Text size="xs" c="dimmed" role="status">
                    {copyStatus}
                  </Text>
                )}
                <Text size="xs" c="dimmed">
                  {HANDBOOK_MODULES.filter((module) =>
                    selected.modules.includes(module.id)
                  )
                    .map((module) => module.label)
                    .join(', ')}
                </Text>
                <Divider />
                <TypographyStylesProvider
                  style={{ overflowWrap: 'break-word', overflowX: 'auto' }}
                >
                  <div
                    role="presentation"
                    onClick={(event) => {
                      if (
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      ) {
                        return;
                      }
                      const link = (event.target as Element).closest(
                        'a[href^="#"]'
                      );
                      const id = link?.getAttribute('href')?.slice(1);
                      if (id && procedures.some((item) => item.id === id)) {
                        event.preventDefault();
                        selectProcedure(id, true);
                      }
                    }}
                    dangerouslySetInnerHTML={{ __html: selected.html }}
                  />
                </TypographyStylesProvider>
                <Divider />
                <Group justify="space-between" gap="xs">
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    leftSection={<IconChevronLeft size={16} />}
                    disabled={selectedIndex <= 0}
                    onClick={() =>
                      selectProcedure(results[selectedIndex - 1].id)
                    }
                  >
                    Previous
                  </Button>
                  <Text size="xs" c="dimmed">
                    {selectedIndex + 1} of {results.length}
                  </Text>
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    rightSection={<IconChevronRight size={16} />}
                    disabled={selectedIndex === results.length - 1}
                    onClick={() =>
                      selectProcedure(results[selectedIndex + 1].id)
                    }
                  >
                    Next
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Stack align="flex-start" py="xl" gap="sm">
                <Title order={2} size="h3">
                  No matching procedures
                </Title>
                <Text size="sm" c="dimmed">
                  {query
                    ? `No results for "${query}".`
                    : 'No procedures in this module.'}
                </Text>
                <Button
                  variant="light"
                  color="teal"
                  leftSection={<IconX size={16} />}
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              </Stack>
            )}
          </Box>
        </Flex>
      </Stack>
      <Drawer
        opened={browseOpened}
        onClose={() => setBrowseOpened(false)}
        title="Browse Handbook"
        size="sm"
        returnFocus={false}
      >
        {procedureNavigation}
      </Drawer>
    </PageLayout>
  );
}
