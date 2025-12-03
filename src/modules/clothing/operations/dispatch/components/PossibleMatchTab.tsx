'use client';

import { memo } from 'react';
import {
  Stack,
  Text,
  Group,
  ActionIcon,
  Tooltip,
  Badge,
  Card,
  Button,
  Progress,
  Accordion,
} from '@mantine/core';
import {
  IconMessageCircle,
  IconLink,
  IconMapPin,
  IconPhone,
  IconUser,
} from '@tabler/icons-react';
import type { UnmatchedOrder, RawOrderData } from '../types';

interface PossibleMatch {
  customer: {
    id: number;
    customerName: string;
    businessName: string;
    phoneNumber: string;
    address: string;
    additionalAddresses: string[];
  };
  similarityScore: number;
  addressScore: number;
  phoneScore: number;
  nameScore: number;
  overallScore: number;
  details: string;
}

interface PossibleMatchTabProps {
  unmatchedOrders: UnmatchedOrder[];
  effectiveRawData: RawOrderData[];
  getMatchesForOrder: (orderId: string) => PossibleMatch[] | null;
  handleLinkCustomer: (
    orderId: string,
    customerId: number,
    customerName: string,
    username: string,
    deliveryAddress: string,
    addressScore: number
  ) => Promise<void>;
  lookupFacebookLinkById: (id: number) => string | undefined;
  copyToClipboard: (text: string, label: string) => Promise<void>;
  stats: {
    totalUnmatchedOrders: number;
    ordersWithPossibleMatches: number;
    ordersWithoutMatches: number;
    averageMatchesPerOrder: number;
  };
  loadingMatches: boolean;
}

function PossibleMatchTabComponent({
  unmatchedOrders,
  effectiveRawData,
  getMatchesForOrder,
  handleLinkCustomer,
  lookupFacebookLinkById,
  copyToClipboard,
  stats,
  loadingMatches,
}: PossibleMatchTabProps) {
  return (
    <Stack gap="md">
      {/* Stats Card */}
      <Card withBorder padding="lg">
        <Stack gap="sm">
          <Text size="lg" fw={600}>
            Possible Matches Overview
          </Text>
          <Group gap="xl">
            <div>
              <Text size="xs" c="dimmed">
                Unmatched Orders
              </Text>
              <Text size="xl" fw={700} c="orange">
                {stats.totalUnmatchedOrders}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                With Possible Matches
              </Text>
              <Text size="xl" fw={700} c="blue">
                {stats.ordersWithPossibleMatches}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Without Matches
              </Text>
              <Text size="xl" fw={700} c="red">
                {stats.ordersWithoutMatches}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Avg Matches/Order
              </Text>
              <Text size="xl" fw={700} c="teal">
                {stats.averageMatchesPerOrder}
              </Text>
            </div>
          </Group>
          {loadingMatches && (
            <Progress value={100} animated color="blue" size="sm" />
          )}
        </Stack>
      </Card>

      {/* Unmatched Orders List */}
      {unmatchedOrders.length === 0 ? (
        <Card withBorder padding="xl">
          <Text ta="center" c="dimmed" size="lg">
            {effectiveRawData.length === 0
              ? 'No data imported yet. Go to Raw Data tab to import orders.'
              : 'All orders have been matched! 🎉'}
          </Text>
        </Card>
      ) : (
        <Accordion variant="separated">
          {unmatchedOrders.map((order) => {
            const matches = getMatchesForOrder(order.orderId);

            return (
              <Accordion.Item key={order.orderId} value={order.orderId}>
                <Accordion.Control>
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>{order.username}</Text>
                      <Text size="sm" c="dimmed">
                        Order: {order.orderId}
                      </Text>
                    </div>
                    <Badge
                      color={matches && matches.length > 0 ? 'blue' : 'gray'}
                      variant="light"
                    >
                      {matches ? matches.length : 0} possible match
                      {matches && matches.length !== 1 ? 'es' : ''}
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    {/* Order Details */}
                    <Card withBorder padding="md" bg="gray.0">
                      <Stack gap="xs">
                        <Group gap="xs">
                          <IconMapPin size={16} />
                          <Text size="sm" fw={500}>
                            Delivery Address:
                          </Text>
                        </Group>
                        <Text size="sm" pl="md">
                          {order.deliveryAddress}
                        </Text>

                        <Group gap="md" mt="xs">
                          <Group gap="xs">
                            <IconPhone size={16} />
                            <Text size="sm">{order.phoneNumber}</Text>
                          </Group>
                          <Group gap="xs">
                            <IconUser size={16} />
                            <Text size="sm">{order.receiverName}</Text>
                          </Group>
                        </Group>
                      </Stack>
                    </Card>

                    {/* Possible Matches */}
                    {!matches || matches.length === 0 ? (
                      <Text c="dimmed" ta="center" py="md">
                        No possible matches found for this order.
                      </Text>
                    ) : (
                      <Stack gap="sm">
                        <Text size="sm" fw={600} c="dimmed">
                          POSSIBLE MATCHES (Top {matches.length})
                        </Text>
                        {matches.map((match, index) => (
                          <Card
                            key={match.customer.id}
                            withBorder
                            padding="md"
                            style={{
                              borderLeft: `4px solid ${
                                match.similarityScore >= 80
                                  ? 'var(--mantine-color-green-6)'
                                  : match.similarityScore >= 60
                                    ? 'var(--mantine-color-blue-6)'
                                    : 'var(--mantine-color-yellow-6)'
                              }`,
                            }}
                          >
                            <Group justify="space-between" align="flex-start">
                              <Stack gap="xs" style={{ flex: 1 }}>
                                <Group justify="space-between">
                                  <div>
                                    <Group gap="xs">
                                      <Text
                                        fw={600}
                                        onClick={() =>
                                          copyToClipboard(
                                            match.customer.customerName,
                                            'Customer name'
                                          )
                                        }
                                        style={{ cursor: 'pointer' }}
                                      >
                                        {index + 1}.{' '}
                                        {match.customer.customerName}
                                      </Text>
                                      <Tooltip
                                        label={
                                          lookupFacebookLinkById(
                                            match.customer.id
                                          )
                                            ? 'Message customer'
                                            : 'No Facebook link available'
                                        }
                                      >
                                        <ActionIcon
                                          variant="light"
                                          color="blue"
                                          size="sm"
                                          component="a"
                                          href={
                                            lookupFacebookLinkById(
                                              match.customer.id
                                            ) || '#'
                                          }
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          aria-label="Message customer"
                                          disabled={
                                            !lookupFacebookLinkById(
                                              match.customer.id
                                            )
                                          }
                                          style={{
                                            cursor: lookupFacebookLinkById(
                                              match.customer.id
                                            )
                                              ? 'pointer'
                                              : 'not-allowed',
                                            opacity: lookupFacebookLinkById(
                                              match.customer.id
                                            )
                                              ? 1
                                              : 0.5,
                                          }}
                                        >
                                          <IconMessageCircle size={16} />
                                        </ActionIcon>
                                      </Tooltip>
                                      {match.customer.businessName && (
                                        <Badge variant="light" color="teal">
                                          {match.customer.businessName}
                                        </Badge>
                                      )}
                                    </Group>
                                  </div>
                                  <Badge
                                    size="lg"
                                    color={
                                      match.similarityScore >= 80
                                        ? 'green'
                                        : match.similarityScore >= 60
                                          ? 'blue'
                                          : 'yellow'
                                    }
                                  >
                                    {match.similarityScore}% Match
                                  </Badge>
                                </Group>

                                <Text size="sm" c="dimmed">
                                  {match.details}
                                </Text>

                                <Stack gap={4} mt="xs">
                                  <Group gap="xs">
                                    <IconMapPin size={14} />
                                    <Text
                                      size="xs"
                                      c="dimmed"
                                      style={{ flex: 1 }}
                                    >
                                      {match.customer.address}
                                    </Text>
                                  </Group>
                                  {match.customer.phoneNumber && (
                                    <Group gap="xs">
                                      <IconPhone size={14} />
                                      <Text size="xs" c="dimmed">
                                        {match.customer.phoneNumber}
                                      </Text>
                                    </Group>
                                  )}
                                </Stack>

                                <Group gap="xs" mt="sm">
                                  <Progress
                                    value={match.addressScore}
                                    size="sm"
                                    color="blue"
                                    style={{ flex: 1 }}
                                  />
                                  <Text
                                    size="xs"
                                    c="dimmed"
                                    style={{ minWidth: '100px' }}
                                  >
                                    Address: {match.addressScore}%
                                  </Text>
                                </Group>
                              </Stack>

                              <Button
                                leftSection={<IconLink size={16} />}
                                variant="light"
                                color="green"
                                onClick={() =>
                                  handleLinkCustomer(
                                    order.orderId,
                                    match.customer.id,
                                    match.customer.customerName,
                                    order.username,
                                    order.deliveryAddress,
                                    match.addressScore
                                  )
                                }
                              >
                                Link Customer
                              </Button>
                            </Group>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}
    </Stack>
  );
}

export const PossibleMatchTab = memo(PossibleMatchTabComponent);
PossibleMatchTab.displayName = 'PossibleMatchTab';
