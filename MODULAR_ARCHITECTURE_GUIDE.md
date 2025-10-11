# 🏗️ Modular Architecture Guide for Business Management System

## Overview

This guide outlines how to make your business management system fully modular, allowing you to plug in/out features without breaking existing code.

---

## 1️⃣ **Core Principles**

### **Single Responsibility**

- Each module handles ONE business domain
- Modules don't know about each other's internals
- Communication through well-defined interfaces

### **Dependency Inversion**

- Depend on abstractions, not implementations
- Use dependency injection
- Interface-based contracts

### **Open/Closed Principle**

- Open for extension, closed for modification
- Add features by adding new modules, not changing existing ones

---

## 2️⃣ **Module Structure Template**

### **Standard Module Layout**

```
src/modules/[feature-name]/
├── components/           # UI components specific to this module
│   ├── [Feature]Table.tsx
│   ├── [Feature]Form.tsx
│   └── [Feature]Card.tsx
├── hooks/               # Custom React hooks
│   ├── use[Feature]Data.ts
│   └── use[Feature]Actions.ts
├── services/            # Business logic & API calls
│   └── [feature]Service.ts
├── types/               # TypeScript types/interfaces
│   └── [feature].types.ts
├── utils/               # Helper functions
│   └── [feature].utils.ts
├── config/              # Configuration
│   └── [feature].config.ts
├── store/               # State management (if needed)
│   └── [feature]Store.ts
└── index.ts             # Public API (what module exports)
```

---

## 3️⃣ **Module Registry System**

### **Create Module Registry**

```typescript
// src/core/ModuleRegistry.ts
export interface ModuleConfig {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  dependencies?: string[];
  routes?: RouteConfig[];
  navigation?: NavigationConfig[];
  permissions?: string[];
}

export interface RouteConfig {
  path: string;
  component: React.ComponentType;
  protected?: boolean;
}

export interface NavigationConfig {
  label: string;
  icon: React.ComponentType;
  path: string;
  order: number;
  workspace?: string[];
}

class ModuleRegistry {
  private modules = new Map<string, ModuleConfig>();

  register(module: ModuleConfig): void {
    // Validate dependencies
    if (module.dependencies) {
      this.validateDependencies(module.dependencies);
    }

    this.modules.set(module.id, module);
    console.log(`✅ Module registered: ${module.name}`);
  }

  unregister(moduleId: string): void {
    this.modules.delete(moduleId);
    console.log(`❌ Module unregistered: ${moduleId}`);
  }

  get(moduleId: string): ModuleConfig | undefined {
    return this.modules.get(moduleId);
  }

  getAll(): ModuleConfig[] {
    return Array.from(this.modules.values());
  }

  getEnabled(): ModuleConfig[] {
    return this.getAll().filter((m) => m.enabled);
  }

  private validateDependencies(deps: string[]): void {
    for (const dep of deps) {
      if (!this.modules.has(dep)) {
        throw new Error(`Missing dependency: ${dep}`);
      }
    }
  }
}

export const moduleRegistry = new ModuleRegistry();
```

---

## 4️⃣ **Example: Modular Due Dates Feature**

### **Step 1: Create Module Structure**

```typescript
// src/modules/due-dates/index.ts
import { ModuleConfig } from '@/core/ModuleRegistry';
import { IconCalendar } from '@tabler/icons-react';

export const dueDatesModule: ModuleConfig = {
  id: 'due-dates',
  name: 'Due Dates',
  version: '1.0.0',
  enabled: true,
  dependencies: ['transactions', 'customers'],

  routes: [
    {
      path: '/due-dates',
      component: () => import('./pages/DueDatesPage'),
      protected: true,
    },
  ],

  navigation: [
    {
      label: 'Due Dates',
      icon: IconCalendar,
      path: '/due-dates',
      order: 5,
      workspace: ['operations'],
    },
  ],

  permissions: [
    'due-dates:view',
    'due-dates:edit',
    'due-dates:contact-customer',
  ],
};
```

### **Step 2: Create Service Layer**

```typescript
// src/modules/due-dates/services/dueDatesService.ts
import { TransactionService } from '@/services';

export class DueDatesService {
  static async getDueDates(filters?: DueDatesFilters) {
    const transactions = await TransactionService.getAll();

    return transactions
      .filter(
        (t) =>
          t['Invoice Date'] &&
          t['Line Total'] > 0 &&
          t['Order Status'] === 'Prepared'
      )
      .reduce((acc, txn) => {
        // Group by customer logic
        return acc;
      }, new Map());
  }

  static async getCustomerOrders(customerId: string) {
    return TransactionService.getByCustomer(customerId);
  }
}
```

### **Step 3: Create Custom Hook**

```typescript
// src/modules/due-dates/hooks/useDueDates.ts
import { useQuery } from '@tanstack/react-query';
import { DueDatesService } from '../services/dueDatesService';

export function useDueDates(filters?: DueDatesFilters) {
  return useQuery({
    queryKey: ['due-dates', filters],
    queryFn: () => DueDatesService.getDueDates(filters),
    staleTime: 5 * 60 * 1000,
  });
}
```

### **Step 4: Expose Public API**

```typescript
// src/modules/due-dates/index.ts
export { dueDatesModule } from './module.config';
export { DueDatesService } from './services/dueDatesService';
export { useDueDates } from './hooks/useDueDates';
export type { DueDateItem, DueDatesFilters } from './types';

// DON'T export internal components
```

---

## 5️⃣ **Plugin System**

### **Create Plugin Interface**

```typescript
// src/core/Plugin.ts
export interface Plugin {
  name: string;
  version: string;

  // Lifecycle hooks
  onInstall?(): void | Promise<void>;
  onUninstall?(): void | Promise<void>;
  onEnable?(): void | Promise<void>;
  onDisable?(): void | Promise<void>;

  // Extension points
  extendRoutes?(): RouteConfig[];
  extendNavigation?(): NavigationConfig[];
  extendAPI?(): Record<string, any>;
}

export class PluginManager {
  private plugins = new Map<string, Plugin>();

  async install(plugin: Plugin): Promise<void> {
    await plugin.onInstall?.();
    this.plugins.set(plugin.name, plugin);
  }

  async uninstall(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      await plugin.onUninstall?.();
      this.plugins.delete(pluginName);
    }
  }

  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}

export const pluginManager = new PluginManager();
```

---

## 6️⃣ **Event Bus for Module Communication**

```typescript
// src/core/EventBus.ts
type EventHandler = (data: any) => void;

class EventBus {
  private events = new Map<string, EventHandler[]>();

  on(event: string, handler: EventHandler): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }

    this.events.get(event)!.push(handler);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: string, data?: any): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }
}

export const eventBus = new EventBus();

// Usage in modules:
// eventBus.emit('customer:updated', { id: '123' });
// eventBus.on('customer:updated', (data) => { ... });
```

---

## 7️⃣ **Dynamic Route Generation**

```typescript
// src/core/DynamicRouter.tsx
import { moduleRegistry } from './ModuleRegistry';

export function generateRoutes() {
  const modules = moduleRegistry.getEnabled();

  return modules.flatMap(module =>
    module.routes?.map(route => ({
      path: route.path,
      element: <route.component />,
      protected: route.protected,
    })) || []
  );
}

// In your app router:
const routes = generateRoutes();
```

---

## 8️⃣ **Dynamic Navigation Generation**

```typescript
// src/components/navigation/DynamicSidebar.tsx
import { moduleRegistry } from '@/core/ModuleRegistry';

export function DynamicSidebar() {
  const modules = moduleRegistry.getEnabled();

  const navItems = modules
    .flatMap(m => m.navigation || [])
    .sort((a, b) => a.order - b.order)
    .filter(item =>
      item.workspace?.includes(selectedWorkspace)
    );

  return (
    <Stack>
      {navItems.map(item => (
        <NavLink
          key={item.path}
          href={item.path}
          label={item.label}
          leftSection={<item.icon />}
        />
      ))}
    </Stack>
  );
}
```

---

## 9️⃣ **Configuration Management**

```typescript
// src/core/ConfigManager.ts
interface AppConfig {
  modules: Record<string, ModuleSettings>;
  features: Record<string, boolean>;
  theme: ThemeConfig;
}

class ConfigManager {
  private config: AppConfig;

  load(): AppConfig {
    // Load from file, environment, or database
    return this.config;
  }

  get(key: string): any {
    return this.config[key];
  }

  isModuleEnabled(moduleId: string): boolean {
    return this.config.modules[moduleId]?.enabled ?? false;
  }

  isFeatureEnabled(featureFlag: string): boolean {
    return this.config.features[featureFlag] ?? false;
  }
}

export const configManager = new ConfigManager();
```

---

## 🔟 **Implementation Checklist**

### **Phase 1: Foundation** ✅

- [ ] Create core module registry
- [ ] Set up event bus
- [ ] Create plugin system
- [ ] Add configuration manager

### **Phase 2: Refactor Existing Features** 🔄

- [ ] Extract Due Dates into module
- [ ] Extract Transactions into module
- [ ] Extract Customers into module
- [ ] Extract Products into module

### **Phase 3: Dynamic Systems** 🚀

- [ ] Implement dynamic routing
- [ ] Implement dynamic navigation
- [ ] Add permission system
- [ ] Create module marketplace UI

### **Phase 4: Testing & Documentation** 📚

- [ ] Unit tests for each module
- [ ] Integration tests
- [ ] API documentation
- [ ] Module creation guide

---

## 1️⃣1️⃣ **Best Practices**

### **DO:**

- ✅ Keep modules independent
- ✅ Use clear interfaces
- ✅ Version your modules
- ✅ Document public APIs
- ✅ Write tests for modules
- ✅ Use dependency injection
- ✅ Communicate via events

### **DON'T:**

- ❌ Import internal module files
- ❌ Create circular dependencies
- ❌ Hardcode module paths
- ❌ Share state directly
- ❌ Bypass the module API
- ❌ Tightly couple modules

---

## 1️⃣2️⃣ **Example: Adding a New "Reports" Module**

```typescript
// 1. Create module structure
src/modules/reports/
├── components/
├── hooks/
├── services/
└── index.ts

// 2. Define module
export const reportsModule: ModuleConfig = {
  id: 'reports',
  name: 'Reports',
  version: '1.0.0',
  enabled: true,
  dependencies: ['transactions', 'customers'],
  routes: [/* ... */],
  navigation: [/* ... */],
};

// 3. Register module
moduleRegistry.register(reportsModule);

// 4. Done! No changes to existing code needed!
```

---

## 1️⃣3️⃣ **Migration Path**

### **Week 1-2: Setup Core Infrastructure**

- Set up module registry
- Create event bus
- Add plugin manager

### **Week 3-4: Migrate One Feature**

- Start with smallest feature (e.g., Due Dates)
- Extract to module
- Test thoroughly

### **Week 5-8: Migrate Remaining Features**

- One feature per week
- Maintain backward compatibility
- Update documentation

### **Week 9-10: Dynamic Systems**

- Implement dynamic routing
- Implement dynamic navigation
- Add module management UI

---

## 1️⃣4️⃣ **Tools & Libraries to Consider**

- **Module Federation**: Webpack Module Federation for runtime module loading
- **Micro-frontends**: Single-SPA or Module Federation
- **State Management**: Zustand with slices per module
- **API Layer**: tRPC for type-safe module APIs
- **Testing**: Vitest for module testing
- **Documentation**: TypeDoc for API docs

---

## 📊 **Benefits of This Approach**

1. **Easy Feature Toggles**: Enable/disable modules via config
2. **Independent Development**: Teams can work on separate modules
3. **Safe Updates**: Update one module without affecting others
4. **Easy Testing**: Test modules in isolation
5. **Plugin Marketplace**: Allow third-party modules
6. **Version Management**: Roll back specific modules
7. **Performance**: Lazy load modules on demand

---

## 🎯 **Next Steps**

1. Review this guide with your team
2. Start with Phase 1 (Foundation)
3. Pick ONE feature to modularize first
4. Learn from that experience
5. Scale to other features
6. Continuously improve the system

---

**Remember**: Modular architecture is a journey, not a destination. Start small, iterate, and improve continuously! 🚀
