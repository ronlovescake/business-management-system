/**
 * Module Template Configuration
 *
 * Copy this template when creating new modules.
 * Follow this pattern for consistent module structure across the codebase.
 *
 * Usage:
 * 1. Copy this entire _template folder
 * 2. Rename to your feature name
 * 3. Update this config with your module details
 * 4. Create your components, hooks, services, types
 * 5. Register in src/modules/index.ts
 */

import type { ModuleConfig, IconComponent } from '@/core/ModuleRegistry';

// Import your icon from Tabler Icons
// import { IconYourIcon } from '@tabler/icons-react';

// Placeholder icon component
const PlaceholderIcon: IconComponent = () => null;

export const templateModule: ModuleConfig = {
  // Unique identifier: {business}-{feature}
  id: 'template-module',

  // Display name for UI
  name: 'Module Template',

  // Semantic versioning
  version: '1.0.0',

  // Module enabled by default
  enabled: false, // Set to false for template

  // Optional: Dependencies on other modules
  dependencies: [],

  // Navigation entries (can have multiple)
  navigation: [
    {
      label: 'Template',
      path: '/business/workspace/feature',
      icon: PlaceholderIcon, // Replace with your icon
      order: 999, // Lower number = higher in list
      business: ['clothing'], // or ['trucking'] or both
      workspace: ['operations'], // or ['employees'], etc.
    },
  ],

  // Route configuration
  routes: [
    {
      path: '/business/workspace/feature',
      component: async () => {
        // This will be replaced with actual component import
        return { default: () => null };
      },
      protected: true, // Requires authentication
    },
  ],

  // Access control (array of role names)
  permissions: ['admin', 'manager', 'user'],

  // Optional metadata
  metadata: {
    description: 'Template module for creating new features',
    author: 'Your Name',
    tags: ['template', 'example'],
  },
};
