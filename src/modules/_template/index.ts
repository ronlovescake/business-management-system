/**
 * Module Template - Public API
 *
 * This file exports everything that should be accessible from outside the module.
 * Other modules should only import from this index file, not from internal files.
 */

export { templateModule } from './module.config';
export * from './components/TemplatePage';
export * from './components/TemplateControlPanel';
export * from './components/TemplateStatsCards';
export * from './components/TemplateTable';
export * from './hooks/useTemplateDashboard';
export * from './types/template.types';
