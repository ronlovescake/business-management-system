import type { NavigationItem, WorkspaceDefinition } from '../navigationItems';

export interface HeaderQuickActionsProps {
  unreadMessages?: number;
  unreadNotifications?: number;
  userInitials?: string;
}

export type ChatWindowState = {
  id: string;
  minimized: boolean;
};

export type WorkspaceNavSection = {
  workspace: WorkspaceDefinition;
  items: NavigationItem[];
};
