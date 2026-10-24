import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogisticsCostsTab } from '../LogisticsCostsTab';
import type { ShipmentData } from '../../types/shipment.types';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), notify: vi.fn() }));
const originalScroll = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollIntoView'
);
vi.mock('@mantine/notifications', () => ({ showNotification: mocks.notify }));

const shipments: ShipmentData[] = [1, 2].map((id) => ({
  id,
  'Shipment Code': `SHIP-${id}`,
  'CV Number': '',
  'No. Of Sacks': 1,
  'Total CBM': 1,
  Weight: 1,
  Fee: 0,
  'Shipment Status': 'Delivered',
  'Date Created': '',
  'Date Delivered': '2026-10-24',
  Duration: '',
  Notes: '',
  linkedProductForwardersFee: 10000,
}));
const history = (requiresReview = false) =>
  Response.json({ data: { lines: [], requiresReview } });
const mount = () =>
  render(
    <MantineProvider>
      <LogisticsCostsTab shipments={shipments} />
    </MantineProvider>
  );
async function choose(id = 1) {
  fireEvent.click(screen.getByPlaceholderText('Select shipment'));
  fireEvent.click(await screen.findByRole('option', { name: `SHIP-${id}` }));
}
const postButton = () => screen.getByRole('button', { name: 'Post Entry' });
const posted = () =>
  mocks.fetch.mock.calls.filter((call) => call[1]?.method === 'POST');

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubGlobal('fetch', mocks.fetch);
  vi.stubGlobal('crypto', {
    randomUUID: () => 'b77fe8f9-cda5-44ea-a187-4527e7698526',
  });
  mocks.fetch.mockImplementation(async () => history());
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalScroll) {
    Object.defineProperty(
      HTMLElement.prototype,
      'scrollIntoView',
      originalScroll
    );
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  }
});

describe('actual logistics posting controls', () => {
  it('does not copy the pricing estimate into the actual posting amount', async () => {
    mount();
    await choose();
    await waitFor(() => expect(postButton()).not.toBeDisabled());
    expect(screen.getByRole('textbox', { name: /Actual Amount/ })).toHaveValue(
      '₱ 0'
    );
    expect(screen.getByText('Forwarder pricing estimate')).toBeInTheDocument();
    expect(posted()).toHaveLength(0);
  });

  it('locks guided posting while legacy journals require review', async () => {
    mocks.fetch.mockImplementation(async () => history(true));
    mount();
    await choose();
    expect(
      await screen.findByText('Existing journals require review')
    ).toBeInTheDocument();
    expect(postButton()).toBeDisabled();
  });

  it('keeps posting locked when history cannot be loaded', async () => {
    mocks.fetch.mockRejectedValue(new Error('History unavailable'));
    mount();
    await choose();
    expect(
      await screen.findByText('Logistics history unavailable')
    ).toBeInTheDocument();
    expect(postButton()).toBeDisabled();
  });

  it('ignores the old shipment response after selecting another shipment', async () => {
    let release!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    mocks.fetch.mockImplementation((url: string) =>
      url.includes('shipmentId=1') ? pending : Promise.resolve(history())
    );
    mount();
    await choose(1);
    await choose(2);
    await waitFor(() => expect(postButton()).not.toBeDisabled());
    await act(async () => {
      release(history(true));
    });
    expect(
      screen.queryByText('Existing journals require review')
    ).not.toBeInTheDocument();
    expect(postButton()).not.toBeDisabled();
  });

  it('uses the same request key when retrying an uncertain network response', async () => {
    let attempts = 0;
    mocks.fetch.mockImplementation(
      async (_url: string, options?: RequestInit) => {
        if (options?.method !== 'POST') {
          return history();
        }
        if (++attempts === 1) {
          throw new TypeError('Network interrupted');
        }
        return Response.json({ data: { reused: true } });
      }
    );
    mount();
    await choose();
    await waitFor(() => expect(postButton()).not.toBeDisabled());
    fireEvent.change(screen.getByRole('textbox', { name: /Actual Amount/ }), {
      target: { value: '5000' },
    });
    fireEvent.click(postButton());
    await waitFor(() =>
      expect(mocks.notify).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'red' })
      )
    );
    await waitFor(() => expect(postButton()).not.toBeDisabled());
    fireEvent.click(postButton());
    await waitFor(() => expect(posted()).toHaveLength(2));
    const bodies = posted().map((call) => JSON.parse(call[1].body));
    expect(bodies[0].requestId).toBe(bodies[1].requestId);
    expect(bodies[1].amount).toBe(5000);
  });

  it('sends only one request for repeated clicks while posting', async () => {
    let release!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    mocks.fetch.mockImplementation((_url: string, options?: RequestInit) =>
      options?.method === 'POST' ? pending : Promise.resolve(history())
    );
    mount();
    await choose();
    await waitFor(() => expect(postButton()).not.toBeDisabled());
    fireEvent.change(screen.getByRole('textbox', { name: /Actual Amount/ }), {
      target: { value: '5000' },
    });
    fireEvent.click(postButton());
    fireEvent.click(postButton());
    await waitFor(() => expect(posted()).toHaveLength(1));
    await act(async () => {
      release(Response.json({ data: { reused: false } }));
    });
  });
});
