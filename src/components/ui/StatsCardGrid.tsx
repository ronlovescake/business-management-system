import type { ReactNode, CSSProperties } from 'react';
import {
  Card,
  Group,
  Text,
  ThemeIcon,
  Title,
  type CardProps,
  type GroupProps,
} from '@mantine/core';
import type { ThemeIconProps } from '@mantine/core';
import { formatNumber } from '@/lib/formatters';

export interface StatCard {
  title: string;
  value: string | number;
  icon: ReactNode;
  color: string;
  backgroundColor?: string;
}

export type StatsCardVariant = 'vibrant' | 'subtle';

export interface StatsCardGridProps {
  cards: StatCard[];
  spacing?: GroupProps['gap'];
  radius?: CardProps['radius'];
  variant?: StatsCardVariant;
  valueFormatter?: (value: StatCard['value']) => ReactNode;
  minCardWidth?: number | string;
  containerStyle?: CSSProperties;
}

interface VariantConfig {
  getCardProps: (card: StatCard, radius: CardProps['radius']) => CardProps;
  titleProps: {
    color: string;
    size: string;
    fontWeight: number;
    style?: CSSProperties;
  };
  valueColor: string;
  iconProps: ThemeIconProps;
}

const variantConfigMap: Record<StatsCardVariant, VariantConfig> = {
  vibrant: {
    getCardProps: (card, radius) => ({
      shadow: 'sm',
      padding: 'md',
      radius,
      withBorder: false,
      style: {
        cursor: 'default',
        background: card.backgroundColor || 'var(--mantine-color-blue-6)',
        color: '#ffffff',
      },
    }),
    titleProps: {
      color: 'rgba(255, 255, 255, 0.85)',
      size: 'xs',
      fontWeight: 600,
      style: { letterSpacing: '0.05em' },
    },
    valueColor: '#ffffff',
    iconProps: {
      variant: 'white',
      size: 'lg',
      radius: 'md',
    },
  },
  subtle: {
    getCardProps: (card, radius) => ({
      shadow: 'xs',
      padding: 'md',
      radius,
      withBorder: true,
      bg: card.backgroundColor || '#ffffff',
      style: {
        borderColor: '#cbd5f5',
        borderWidth: '1px',
        cursor: 'default',
      },
    }),
    titleProps: {
      color: '#6b7280',
      size: 'xs',
      fontWeight: 500,
    },
    valueColor: '#1f2937',
    iconProps: {
      variant: 'light',
      size: 'lg',
      radius: 'md',
    },
  },
};

const formatValue = (value: StatCard['value']): string | number => {
  if (typeof value === 'number') {
    return formatNumber(value);
  }
  return value;
};

export function StatsCardGrid({
  cards,
  spacing = 'md',
  radius = 'md',
  variant = 'vibrant',
  valueFormatter,
  minCardWidth = 220,
  containerStyle,
}: StatsCardGridProps) {
  if (!cards || cards.length === 0) {
    return null;
  }

  const selectedVariant = variantConfigMap[variant];
  const computedMinWidth =
    typeof minCardWidth === 'number' ? `${minCardWidth}px` : minCardWidth;

  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        paddingBottom: '0.25rem',
        ...containerStyle,
      }}
    >
      <Group
        wrap="nowrap"
        gap={spacing}
        align="stretch"
        style={{ width: '100%' }}
      >
        {cards.map((card, index) => {
          const cardKey = card.title
            ? `${card.title}-${index}`
            : `stat-${index}`;
          const cardProps = selectedVariant.getCardProps(card, radius);
          const iconProps = selectedVariant.iconProps;
          const valueContent = valueFormatter
            ? valueFormatter(card.value)
            : formatValue(card.value);

          return (
            <Card
              key={cardKey}
              {...cardProps}
              style={{
                ...cardProps.style,
                minWidth: computedMinWidth,
                flex: '1 1 0',
              }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div>
                  <Text
                    size={selectedVariant.titleProps.size}
                    c={selectedVariant.titleProps.color}
                    fw={selectedVariant.titleProps.fontWeight}
                    style={selectedVariant.titleProps.style}
                  >
                    {card.title}
                  </Text>
                  <Title order={3} c={selectedVariant.valueColor} mt="xs">
                    {valueContent}
                  </Title>
                </div>
                <ThemeIcon {...iconProps} color={card.color}>
                  {card.icon}
                </ThemeIcon>
              </Group>
            </Card>
          );
        })}
      </Group>
    </div>
  );
}
