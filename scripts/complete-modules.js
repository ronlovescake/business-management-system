#!/usr/bin/env node

/**
 * Automated Module Completion Script
 * 
 * This script systematically adds:
 * 1. Error boundaries to all module pages
 * 2. React.memo to all modal/dialog components
 * 
 * Usage: node scripts/complete-modules.js
 */

const fs = require('fs');
const path = require('path');

const ERROR_BOUNDARY_TEMPLATE = (moduleName, displayName) => `/**
 * ${displayName} Error Boundary
 */

'use client';

import React, { Component, type ReactNode } from 'react';
import { Stack, Text, Button, Paper, Title, Code } from '@mantine/core';
import { IconAlertTriangle, IconRefresh, IconHome } from '@tabler/icons-react';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ${moduleName}ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: React.ErrorInfo): void {
    logger.error('${displayName} module error:', error);
    this.setState({ error });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Stack align="center" justify="center" style={{ minHeight: '400px' }}>
          <Paper shadow="md" p="xl" withBorder style={{ maxWidth: 600 }}>
            <Stack gap="md">
              <Stack gap="xs" align="center">
                <IconAlertTriangle size={48} color="red" />
                <Title order={2}>${displayName} Module Error</Title>
              </Stack>
              <Text c="dimmed" ta="center">An error occurred in the ${displayName.toLowerCase()} module.</Text>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <Code block color="red">{this.state.error.message}</Code>
              )}
              <Stack gap="sm">
                <Button leftSection={<IconRefresh size={16} />} onClick={() => window.location.reload()} fullWidth>Reload</Button>
                <Button leftSection={<IconHome size={16} />} onClick={() => window.location.href = '/'} variant="light" fullWidth>Home</Button>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      );
    }
    return this.props.children;
  }
}
`;

const MODULES = {
  operations: [
    // Already completed
    // { name: 'due-dates', displayName: 'Due Dates', workspace: 'operations' },
    // { name: 'settings', displayName: 'Settings', workspace: 'operations' },
    // { name: 'sorting-distribution', displayName: 'Sorting Distribution', workspace: 'operations' },
    // { name: 'business-intelligence', displayName: 'Business Intelligence', workspace: 'operations' },
    // { name: 'dashboard', displayName: 'Dashboard', workspace: 'operations' },
    
    // Remaining modules to process
    { name: 'inventory', displayName: 'Inventory', workspace: 'operations' },
    { name: 'pickup-form', displayName: 'Pickup Form', workspace: 'operations' },
    { name: 'post-template', displayName: 'Post Template', workspace: 'operations' },
    { name: 'shipments-dashboard', displayName: 'Shipments Dashboard', workspace: 'operations' },
    { name: 'notifications', displayName: 'Notifications', workspace: 'operations' },
  ],
  employees: [
    // Already completed
    // { name: 'schedules', displayName: 'Schedules', workspace: 'employees' },
    // { name: 'leave-tracker', displayName: 'Leave Tracker', workspace: 'employees' },
    // { name: 'employee-loans', displayName: 'Employee Loans', workspace: 'employees' },
    // { name: 'team', displayName: 'Team', workspace: 'employees' },
    // { name: 'calendar', displayName: 'Calendar', workspace: 'employees' },
    // { name: 'settings', displayName: 'Settings', workspace: 'employees' },
    // { name: 'notifications', displayName: 'Notifications', workspace: 'employees' },
    // { name: 'dashboard', displayName: 'Dashboard', workspace: 'employees' },
  ],
};

function toPascalCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function createErrorBoundary(modulePath, moduleName, displayName) {
  const componentDir = path.join(modulePath, 'components');
  
  // Check if components directory exists, if not create it
  if (!fs.existsSync(componentDir)) {
    console.log(`  Creating components directory: ${componentDir}`);
    fs.mkdirSync(componentDir, { recursive: true });
  }
  
  const errorBoundaryPath = path.join(componentDir, `${moduleName}ErrorBoundary.tsx`);
  
  if (fs.existsSync(errorBoundaryPath)) {
    console.log(`  ✓ Error boundary already exists: ${errorBoundaryPath}`);
    return false;
  }
  
  fs.writeFileSync(errorBoundaryPath, ERROR_BOUNDARY_TEMPLATE(moduleName, displayName));
  console.log(`  ✓ Created error boundary: ${errorBoundaryPath}`);
  return true;
}

function updatePageWithErrorBoundary(pagePath, moduleName, boundaryImportPath) {
  if (!fs.existsSync(pagePath)) {
    console.log(`  ✗ Page not found: ${pagePath}`);
    return false;
  }
  
  let content = fs.readFileSync(pagePath, 'utf8');
  
  // Check if error boundary is already imported
  if (content.includes(`${moduleName}ErrorBoundary`)) {
    console.log(`  ✓ Page already uses error boundary: ${pagePath}`);
    return false;
  }
  
  // Find the main component import
  const componentMatch = content.match(/import\s+{\s*(\w+)\s*}\s+from\s+['"]([^'"]+)['"]/);
  if (!componentMatch) {
    console.log(`  ✗ Could not find component import in: ${pagePath}`);
    return false;
  }
  
  const componentName = componentMatch[1];
  
  // Add error boundary import after the component import
  const importLine = `import { ${moduleName}ErrorBoundary } from '${boundaryImportPath}';`;
  content = content.replace(
    componentMatch[0],
    `${componentMatch[0]}\n${importLine}`
  );
  
  // Wrap the component with error boundary
  const returnMatch = content.match(/return\s+<(\w+)\s*\/>/);
  if (returnMatch) {
    content = content.replace(
      returnMatch[0],
      `return (\n    <${moduleName}ErrorBoundary>\n      <${componentName} />\n    </${moduleName}ErrorBoundary>\n  );`
    );
  } else {
    // Try alternative pattern
    const altReturnMatch = content.match(/return\s+\(\s*<(\w+)\s*\/>\s*\)/);
    if (altReturnMatch) {
      content = content.replace(
        altReturnMatch[0],
        `return (\n    <${moduleName}ErrorBoundary>\n      <${componentName} />\n    </${moduleName}ErrorBoundary>\n  )`
      );
    }
  }
  
  fs.writeFileSync(pagePath, content);
  console.log(`  ✓ Updated page with error boundary: ${pagePath}`);
  return true;
}

function applyReactMemoToComponent(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if React.memo is already applied
  if (content.includes('React.memo')) {
    return false;
  }
  
  // Check if React is imported
  if (!content.includes("import React")) {
    // Add React import at the top
    const firstImportMatch = content.match(/^import/m);
    if (firstImportMatch) {
      content = content.replace(firstImportMatch[0], `import React from 'react';\n${firstImportMatch[0]}`);
    }
  }
  
  // Find the export function pattern
  const exportMatch = content.match(/export\s+function\s+(\w+)\s*\(/);
  if (!exportMatch) {
    return false;
  }
  
  const componentName = exportMatch[1];
  
  // Replace export function with export const ... = React.memo
  content = content.replace(
    `export function ${componentName}(`,
    `export const ${componentName} = React.memo(function ${componentName}(`
  );
  
  // Find the last closing brace and replace with });
  const lastBraceMatch = content.lastIndexOf('\n}\n');
  if (lastBraceMatch !== -1) {
    content = content.substring(0, lastBraceMatch) + '\n});\n' + content.substring(lastBraceMatch + 3);
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`  ✓ Applied React.memo to: ${filePath}`);
  return true;
}

function processModule(workspace, moduleInfo) {
  const { name, displayName } = moduleInfo;
  const pascalName = toPascalCase(name);
  
  console.log(`\nProcessing ${displayName} (${workspace})...`);
  
  const basePath = path.join(__dirname, '..', 'src', 'app', 'clothing', workspace, name);
  const modulePath = path.join(__dirname, '..', 'src', 'modules', 'clothing', workspace, name);
  
  // Check if module exists
  if (!fs.existsSync(basePath) && !fs.existsSync(modulePath)) {
    console.log(`  ✗ Module not found at ${basePath} or ${modulePath}`);
    return;
  }
  
  // Create error boundary
  createErrorBoundary(basePath, pascalName, displayName);
  
  // Update page.tsx
  const pagePath = path.join(basePath, 'page.tsx');
  const boundaryImportPath = './components/' + pascalName + 'ErrorBoundary';
  updatePageWithErrorBoundary(pagePath, pascalName, boundaryImportPath);
  
  // Apply React.memo to modal/dialog components in module
  if (fs.existsSync(modulePath)) {
    const componentsDir = path.join(modulePath, 'components');
    if (fs.existsSync(componentsDir)) {
      const files = fs.readdirSync(componentsDir);
      files.forEach(file => {
        if (file.includes('Modal') || file.includes('Dialog') || file.includes('Form')) {
          const filePath = path.join(componentsDir, file);
          if (fs.lstatSync(filePath).isFile() && file.endsWith('.tsx')) {
            applyReactMemoToComponent(filePath);
          }
        }
      });
    }
  }
}

function main() {
  console.log('🚀 Starting automated module completion...\n');
  
  // Process operations modules
  console.log('═══════════════════════════════════════');
  console.log('  OPERATIONS WORKSPACE MODULES');
  console.log('═══════════════════════════════════════');
  MODULES.operations.forEach(module => processModule('operations', module));
  
  // Process employees modules
  console.log('\n═══════════════════════════════════════');
  console.log('  EMPLOYEES WORKSPACE MODULES');
  console.log('═══════════════════════════════════════');
  MODULES.employees.forEach(module => processModule('employees', module));
  
  console.log('\n✅ Module completion script finished!\n');
}

main();
