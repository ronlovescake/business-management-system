import type {
  IconComponent,
  ModuleConfig,
  ModuleNavigation,
  ModuleRoute,
} from '@/core/ModuleRegistry';

type OperationsModuleOptions = {
  id: string;
  name: string;
  path: string;
  icon: unknown;
  order: number;
  label?: string;
  business?: ModuleNavigation['business'];
  workspace?: ModuleNavigation['workspace'];
  routes?: ModuleRoute[];
  permissions?: ModuleConfig['permissions'];
  metadata?: ModuleConfig['metadata'];
  enabled?: boolean;
  version?: string;
  dependencies?: ModuleConfig['dependencies'];
};

export function createOperationsModuleConfig(
  options: OperationsModuleOptions
): ModuleConfig {
  return {
    id: options.id,
    name: options.name,
    version: options.version ?? '1.0.0',
    enabled: options.enabled ?? true,
    dependencies: options.dependencies,
    navigation: [
      {
        label: options.label ?? options.name,
        path: options.path,
        icon: options.icon as IconComponent,
        order: options.order,
        business: options.business,
        workspace: options.workspace ?? ['operations'],
      },
    ],
    routes: options.routes,
    permissions: options.permissions,
    metadata: options.metadata,
  };
}
