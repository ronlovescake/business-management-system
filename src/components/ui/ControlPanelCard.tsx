import type { ComponentPropsWithoutRef, ReactNode, CSSProperties } from 'react';
import { Card, Stack, Title, Tabs } from '@mantine/core';
import type {
  CardProps,
  StackProps,
  TitleProps,
  TabsProps as MantineTabsProps,
} from '@mantine/core';

const defaultCardStyle: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.15)',
  backdropFilter: 'blur(15px)',
  border: '1px solid rgba(0, 0, 0, 0.2)',
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.2)',
  transition: 'all 0.3s ease',
};

const defaultTitleStyle: CSSProperties = {
  color: '#6b7280',
  textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
};

export type ControlPanelTabsProps = Omit<
  MantineTabsProps,
  'value' | 'onChange'
>;
export type ControlPanelTabProps = Omit<
  ComponentPropsWithoutRef<typeof Tabs.Tab>,
  'value' | 'children'
>;
export type ControlPanelPanelProps = Omit<
  ComponentPropsWithoutRef<typeof Tabs.Panel>,
  'value'
>;

export interface ControlPanelTabConfig {
  value: string;
  label: ReactNode;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
  tabProps?: ControlPanelTabProps;
  panel?: ReactNode;
  panelProps?: ControlPanelPanelProps;
}

export interface ControlPanelCardProps {
  title: string;
  tabs: ControlPanelTabConfig[];
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  cardProps?: CardProps;
  titleProps?: TitleProps;
  stackProps?: StackProps;
  tabsProps?: ControlPanelTabsProps;
}

export function ControlPanelCard({
  title,
  tabs,
  activeTab,
  onTabChange,
  cardProps,
  titleProps,
  stackProps,
  tabsProps,
}: ControlPanelCardProps) {
  const {
    style: cardStyleOverride,
    padding = 'lg',
    radius = 10,
    ...restCardProps
  } = cardProps ?? {};

  const {
    style: titleStyleOverride,
    order = 3,
    ...restTitleProps
  } = titleProps ?? {};

  const { gap = 'md', ...restStackProps } = stackProps ?? {};
  const restTabsProps = tabsProps ?? {};

  return (
    <Card
      padding={padding}
      radius={radius}
      {...restCardProps}
      style={{ ...defaultCardStyle, ...cardStyleOverride }}
    >
      <Stack gap={gap} {...restStackProps}>
        <Title
          order={order}
          {...restTitleProps}
          style={{ ...defaultTitleStyle, ...titleStyleOverride }}
        >
          {title}
        </Title>

        <Tabs value={activeTab} onChange={onTabChange} {...restTabsProps}>
          <Tabs.List>
            {tabs.map(
              ({ value, label, leftSection, rightSection, tabProps }) => (
                <Tabs.Tab
                  key={value}
                  value={value}
                  leftSection={leftSection}
                  rightSection={rightSection}
                  {...tabProps}
                >
                  {label}
                </Tabs.Tab>
              )
            )}
          </Tabs.List>

          {tabs.map(({ value, panel, panelProps }) => {
            const {
              style: panelStyleOverride,
              pt,
              ...restPanelProps
            } = panelProps ?? {};

            return (
              <Tabs.Panel
                key={`${value}-panel`}
                value={value}
                pt={pt ?? 'md'}
                {...restPanelProps}
                style={{ ...panelStyleOverride }}
              >
                {panel ?? <div />}
              </Tabs.Panel>
            );
          })}
        </Tabs>
      </Stack>
    </Card>
  );
}
