# ControlPanelCard

Reusable frosted-glass control surface that centralizes the header + tabs + toolbar pattern introduced for clothing expense management. It keeps the softened background, darker border, and stacked layout so other modules can stay visually consistent without duplicating markup.

## Usage

1. **Import the component**
   ```tsx
   import {
     ControlPanelCard,
     type ControlPanelTabConfig,
   } from '@/components/ui/ControlPanelCard';
   ```
2. **Define your tabs** with labels, optional icons, and the panel content to render when active. Each tab is described by a `ControlPanelTabConfig` object.
   ```tsx
   const tabs: ControlPanelTabConfig[] = [
     {
       value: 'list',
       label: 'Expense List',
       leftSection: <IconList size={16} />,
       panel: <YourToolbar />,
     },
   ];
   ```
3. **Render the card** with the active tab state and change handler from your page/component logic.
   ```tsx
   <ControlPanelCard
     title="Expense Records"
     tabs={tabs}
     activeTab={activeTab}
     onTabChange={setActiveTab}
   />
   ```

### Customization Options

- `cardProps`, `titleProps`, `stackProps`, and `tabsProps` let you override Mantine props for the host elements without rewriting the template.
- `tabProps` and `panelProps` on each tab allow per-tab tweaks (e.g., disabling a tab, changing padding, or injecting additional accessibility props).

Leverage this component anywhere you need a search/filter/action toolbar with tabs—operations dashboards, import/export hubs, or analytics views—while maintaining the same interaction surface users already recognize.
