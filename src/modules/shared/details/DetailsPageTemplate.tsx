import React from 'react';
import { Stack, Tabs } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';

export interface DetailsTabConfig {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface DetailsPageTemplateProps {
  header: React.ReactNode;
  heroSection?: React.ReactNode;
  tabs: DetailsTabConfig[];
  defaultTab?: string;
}

export function DetailsPageTemplate({
  header,
  heroSection,
  tabs,
  defaultTab,
}: DetailsPageTemplateProps) {
  const initialTab = defaultTab ?? tabs[0]?.value;

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        {header}
        {heroSection}

        {tabs.length > 0 && initialTab && (
          <Tabs defaultValue={initialTab} keepMounted={false}>
            <Tabs.List>
              {tabs.map((tab) => (
                <Tabs.Tab key={tab.value} value={tab.value}>
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {tabs.map((tab) => (
              <Tabs.Panel key={tab.value} value={tab.value} pt="md">
                {tab.content}
              </Tabs.Panel>
            ))}
          </Tabs>
        )}
      </Stack>
    </PageLayout>
  );
}
