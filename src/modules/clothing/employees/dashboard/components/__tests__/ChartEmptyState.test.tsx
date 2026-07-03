import React from 'react';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it } from 'vitest';
import { ChartEmptyState } from '../ChartEmptyState';

function renderChartEmptyState(message: string) {
  return render(
    <MantineProvider>
      <ChartEmptyState message={message} />
    </MantineProvider>
  );
}

describe('ChartEmptyState', () => {
  it('renders the provided empty-state message', () => {
    renderChartEmptyState('No attendance data to visualize.');

    expect(
      screen.getByText('No attendance data to visualize.')
    ).toBeInTheDocument();
  });
});
