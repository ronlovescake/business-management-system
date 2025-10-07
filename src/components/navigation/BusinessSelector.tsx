'use client';

import { Breadcrumbs, Button, Menu, Text } from '@mantine/core';
import { IconChevronDown, IconBuilding } from '@tabler/icons-react';
import { useBusinessStore } from '../../lib/store';

const businesses = [
  { value: 'clothing', label: 'Czarlie & Ron Clothing' },
  { value: 'trucking', label: 'Czarlie & Ron Trucking' },
];

export function BusinessSelector() {
  const { selectedBusiness, setSelectedBusiness } = useBusinessStore();

  const currentBusiness = businesses.find((b) => b.value === selectedBusiness);
  const otherBusinesses = businesses.filter(
    (b) => b.value !== selectedBusiness
  );

  return (
    <Breadcrumbs separator="/">
      <Text size="sm" c="dimmed">
        Business
      </Text>
      <Menu shadow="md" width={250}>
        <Menu.Target>
          <Button
            variant="subtle"
            rightSection={<IconChevronDown size={14} />}
            leftSection={<IconBuilding size={16} />}
            size="sm"
          >
            {currentBusiness?.label || 'Select Business'}
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Switch Business</Menu.Label>
          {otherBusinesses.map((business) => (
            <Menu.Item
              key={business.value}
              onClick={() => setSelectedBusiness(business.value)}
              leftSection={<IconBuilding size={16} />}
            >
              {business.label}
            </Menu.Item>
          ))}
          {!currentBusiness &&
            businesses.map((business) => (
              <Menu.Item
                key={business.value}
                onClick={() => setSelectedBusiness(business.value)}
                leftSection={<IconBuilding size={16} />}
              >
                {business.label}
              </Menu.Item>
            ))}
        </Menu.Dropdown>
      </Menu>
    </Breadcrumbs>
  );
}

export default BusinessSelector;
