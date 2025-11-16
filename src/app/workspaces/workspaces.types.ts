export type WorkspaceIconKey = 'settings' | 'users' | 'truck';

export interface WorkspaceOption {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  highlights: string[];
  href: string;
  icon: WorkspaceIconKey;
}

export interface WorkspaceDefinition extends WorkspaceOption {
  requiredPaths: string[];
}
