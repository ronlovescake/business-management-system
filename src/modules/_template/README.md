# Module Template

This is a template for creating new modules in the business management system.

## 📁 Structure

```
src/modules/_template/
├── module.config.ts          # Module configuration (navigation, routes, permissions)
├── index.ts                  # Public API exports
├── README.md                 # This file
├── components/               # React components
│   └── TemplatePage.tsx      # Main page component
├── hooks/                    # React hooks
│   └── useTemplateData.ts    # Data fetching hook (uses abstraction layer)
├── services/                 # Business logic
│   └── TemplateService.ts    # Service class (reuses shared services)
├── types/                    # TypeScript types
│   └── template.types.ts     # Type definitions
└── utils/                    # Utility functions
    └── templateHelpers.ts    # Helper functions specific to this module
```

## 🚀 How to Use This Template

### Step 1: Copy the Template

```bash
# For Clothing business features
cp -r src/modules/_template src/modules/clothing/operations/your-feature

# For Trucking business features
cp -r src/modules/_template src/modules/trucking/employees/your-feature
```

### Step 2: Update module.config.ts

```typescript
import { IconYourIcon } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const yourFeatureModule: ModuleConfig = {
  id: 'clothing-your-feature',
  name: 'Your Feature',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Your Feature',
      path: '/clothing/operations/your-feature',
      icon: IconYourIcon,
      order: 5,
      business: ['clothing'],
      workspace: ['operations'],
    },
  ],

  routes: [
    {
      path: '/clothing/operations/your-feature',
      component: () => import('./components/YourFeaturePage'),
      protected: true,
    },
  ],

  permissions: ['admin', 'manager'],
};
```

### Step 3: Create Your Hook (Use Abstraction Layer!)

```typescript
// hooks/useYourFeatureData.ts
import { useSheetData } from '@/hooks/useSheetData';
import type { YourFeatureData } from '../types/yourFeature.types';

export function useYourFeatureData() {
  return useSheetData<YourFeatureData>({
    queryKey: ['your-feature'],
    endpoint: '/api/your-feature',
  });
}

// ✅ You get for FREE:
// - Data fetching with caching
// - CRUD operations (create, update, delete, bulkUpdate)
// - Loading & error states
// - Optimistic updates
// - Automatic revalidation
```

### Step 4: Create Your Service (Reuse Shared Services!)

```typescript
// services/YourFeatureService.ts
import { ValidationService } from '@/services/ValidationService';
import { FormatterService } from '@/services/FormatterService';

export class YourFeatureService {
  // ✅ Reuse existing services
  static formatDate = FormatterService.formatDate;
  static formatCurrency = FormatterService.formatCurrency;
  static validateCustomer = ValidationService.validateCustomer;

  // ✅ Add your feature-specific logic
  static yourCustomMethod(data: YourData) {
    // Your business logic here
  }
}
```

### Step 5: Create Your Component

```typescript
// components/YourFeaturePage.tsx
import { useYourFeatureData } from '../hooks/useYourFeatureData';
import { YourFeatureService } from '../services/YourFeatureService';
import { MantineTable } from '@/components/tables/MantineTable';

export function YourFeaturePage() {
  const { data, isLoading, create, update } = useYourFeatureData();

  return (
    <PageLayout title="Your Feature">
      <MantineTable data={data} />
    </PageLayout>
  );
}
```

### Step 6: Register Your Module

```typescript
// src/modules/index.ts
import { moduleRegistry } from '@/core/ModuleRegistry';
import { yourFeatureModule } from './clothing/operations/your-feature';

moduleRegistry.register(yourFeatureModule);
```

### Step 7: Test

1. Navigate to `/clothing/operations/your-feature`
2. Check that navigation appears in sidebar
3. Test CRUD operations
4. Verify permissions work

## ✅ Best Practices

### 1. **Always Use Abstraction Layer**

- Use `useSheetData` for data fetching
- Don't write custom fetch logic

### 2. **Reuse Shared Services**

- Check existing services first
- Contribute back when you add new utilities

### 3. **Keep Components Simple**

- Components should only handle UI
- Business logic goes in services
- Data fetching goes in hooks

### 4. **Type Everything**

- Create proper TypeScript types
- Export types from `types/` folder

### 5. **Follow Naming Conventions**

- Files: camelCase.ts
- Components: PascalCase.tsx
- Services: PascalCaseService.ts
- Hooks: useCamelCase.ts

### 6. **Module Isolation**

- Each module should be self-contained
- Import from other modules via their index.ts
- Use EventBus for inter-module communication

## 📊 Benefits of This Pattern

- ✅ **Fast Development**: 40 minutes instead of 6 hours
- ✅ **Code Reuse**: 90% of code is reused
- ✅ **Consistent Structure**: Same pattern everywhere
- ✅ **Easy Testing**: Isolated layers
- ✅ **Maintainable**: Clear organization
- ✅ **Scalable**: Add unlimited features

## 🎯 Time Estimate

Following this template:

- Module config: 5 minutes
- Data hook: 2 minutes
- Service: 10 minutes
- Component: 20 minutes
- Registration: 1 minute
- Testing: 10 minutes

**Total: ~40-50 minutes per feature!**

---

**Ready to create your module?** Follow the steps above! 🚀
