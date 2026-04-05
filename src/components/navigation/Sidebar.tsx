'use client';

import {
  Box,
  UnstyledButton,
  Stack,
  Text,
  Group,
  ThemeIcon,
  Badge,
  Divider,
  Tooltip,
} from '@mantine/core';
import {
  IconShirt,
  IconTruck,
  IconCurrencyPeso,
  IconBoxSeam,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useBusinessStore } from '../../lib/store';
import { BackupRestoreSidebarPanel } from '@/modules/clothing/operations/settings/components/backup-restore/BackupRestoreSidebarPanel';
import { useBackupRestoreSidebarStore } from '@/modules/clothing/operations/settings/components/backup-restore/backupRestoreSidebarStore';
import {
  buildNavigationItems,
  getWorkspaceDefinition,
  isBusiness,
  isWorkspace,
} from './navigationItems';

interface SidebarProps {
  collapsed?: boolean;
}

const NAV_ITEM_ICON_CONTAINER_SIZE = 32;
const NAV_ITEM_ICON_SIZE = 24;
const NAV_ITEM_ROW_HEIGHT = 48;
const NAV_LIST_GAP = 4;
const SIDEBAR_SECTION_SPACING = 12;
const LABEL_TRANSITION = 'width 160ms ease, opacity 120ms ease';

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const [hoveredItemPath, setHoveredItemPath] = useState<string | null>(null);
  const { selectedBusiness, selectedWorkspace, initializeFromPath } =
    useBusinessStore();

  const backupSidebarActive = useBackupRestoreSidebarStore((s) => s.active);

  // Initialize from current path on component mount
  useEffect(() => {
    if ((!selectedBusiness || !selectedWorkspace) && pathname) {
      initializeFromPath(pathname);
    }
  }, [pathname, selectedBusiness, selectedWorkspace, initializeFromPath]);

  const navigationItems = useMemo(() => {
    if (!isBusiness(selectedBusiness) || !isWorkspace(selectedWorkspace)) {
      return [];
    }
    return buildNavigationItems(selectedBusiness, selectedWorkspace);
  }, [selectedBusiness, selectedWorkspace]);

  const workspaceMeta = getWorkspaceDefinition(selectedWorkspace);

  if (backupSidebarActive) {
    return (
      <Stack gap="sm" style={{ height: '100%' }}>
        <BackupRestoreSidebarPanel />
      </Stack>
    );
  }

  if (!isBusiness(selectedBusiness) || !isWorkspace(selectedWorkspace)) {
    return (
      <Stack gap="md">
        <Group>
          <ThemeIcon size="sm" radius="sm" variant="light">
            <IconShirt size={16} />
          </ThemeIcon>
          <Text size="sm" c="dimmed">
            Loading navigation...
          </Text>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap={SIDEBAR_SECTION_SPACING}>
      {/* Header */}
      <Group gap="sm" mb={SIDEBAR_SECTION_SPACING} wrap="nowrap">
        <ThemeIcon
          size="lg"
          radius="md"
          variant="gradient"
          gradient={{
            from:
              selectedBusiness === 'clothing'
                ? 'pink'
                : selectedBusiness === 'trucking'
                  ? 'blue'
                  : selectedBusiness === 'general-merchandise'
                    ? 'orange'
                    : 'teal',
            to:
              selectedBusiness === 'clothing'
                ? 'orange'
                : selectedBusiness === 'trucking'
                  ? 'cyan'
                  : selectedBusiness === 'general-merchandise'
                    ? 'yellow'
                    : 'green',
          }}
        >
          {selectedBusiness === 'clothing' ? (
            <IconShirt size={20} />
          ) : selectedBusiness === 'trucking' ? (
            <IconTruck size={20} />
          ) : selectedBusiness === 'general-merchandise' ? (
            <IconBoxSeam size={20} />
          ) : (
            <IconCurrencyPeso size={20} />
          )}
        </ThemeIcon>
        <Box
          style={{
            width: collapsed ? 0 : 'auto',
            opacity: collapsed ? 0 : 1,
            overflow: 'hidden',
            transition: LABEL_TRANSITION,
            whiteSpace: 'nowrap',
            pointerEvents: collapsed ? 'none' : 'auto',
          }}
        >
          <Stack gap={2}>
            <Text size="sm" fw={600} c="dark">
              {selectedBusiness === 'clothing'
                ? 'Clothing'
                : selectedBusiness === 'trucking'
                  ? 'Trucking'
                  : selectedBusiness === 'general-merchandise'
                    ? 'General Merchandise'
                    : 'Personal Finance'}
            </Text>
            <Badge
              size="xs"
              variant="light"
              color={workspaceMeta?.color ?? 'gray'}
            >
              {workspaceMeta?.label ?? 'Workspace'}
            </Badge>
          </Stack>
        </Box>
      </Group>

      <Divider my={0} />

      {backupSidebarActive ? (
        <BackupRestoreSidebarPanel />
      ) : (
        /* Navigation Items */
        <Stack gap={NAV_LIST_GAP} align="stretch">
          {navigationItems.map((item) => {
            const isActive = pathname === item.path;
            const isHovered = hoveredItemPath === item.path;
            const IconComponent = item.icon;

            return (
              <Tooltip
                key={item.path}
                label={item.label}
                position="right"
                disabled={!collapsed}
              >
                <UnstyledButton
                  component={Link}
                  href={item.path}
                  aria-label={item.label}
                  onMouseEnter={() => setHoveredItemPath(item.path)}
                  onMouseLeave={() => setHoveredItemPath(null)}
                  style={{
                    position: 'relative',
                    width: '100%',
                    minHeight: `${NAV_ITEM_ROW_HEIGHT}px`,
                    borderRadius: '8px',
                    fontWeight: isActive ? 600 : 500,
                    backgroundColor: isActive
                      ? 'rgba(67, 97, 238, 0.14)'
                      : isHovered
                        ? 'rgba(67, 97, 238, 0.08)'
                        : 'transparent',
                    border: isActive
                      ? '1px solid rgba(67, 97, 238, 0.3)'
                      : isHovered
                        ? '1px solid rgba(67, 97, 238, 0.2)'
                        : 'none',
                    boxShadow: isActive
                      ? 'inset 3px 0 0 rgba(67, 97, 238, 0.95), 0 4px 12px rgba(67, 97, 238, 0.12)'
                      : isHovered
                        ? '0 2px 8px rgba(67, 97, 238, 0.08)'
                        : 'none',
                    padding: '0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    overflow: 'hidden',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    transition:
                      'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 120ms ease',
                    transform:
                      isHovered && !isActive ? 'translateX(1px)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Box
                    style={{
                      width: `${NAV_ITEM_ICON_CONTAINER_SIZE}px`,
                      minWidth: `${NAV_ITEM_ICON_CONTAINER_SIZE}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ThemeIcon
                      size={NAV_ITEM_ICON_CONTAINER_SIZE}
                      radius="sm"
                      variant={isActive ? 'filled' : 'light'}
                      color={isActive ? 'indigo' : 'gray'}
                    >
                      <IconComponent size={NAV_ITEM_ICON_SIZE} />
                    </ThemeIcon>
                  </Box>
                  <Box
                    style={{
                      flex: 1,
                      width: collapsed ? 0 : 'auto',
                      opacity: collapsed ? 0 : 1,
                      overflow: 'hidden',
                      transition: LABEL_TRANSITION,
                      whiteSpace: 'nowrap',
                      pointerEvents: collapsed ? 'none' : 'auto',
                    }}
                  >
                    <Text
                      size="sm"
                      c={isActive ? 'indigo.7' : 'dark'}
                      fw={isActive ? 600 : 500}
                      truncate
                    >
                      {item.label}
                    </Text>
                  </Box>
                </UnstyledButton>
              </Tooltip>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

export default Sidebar;
