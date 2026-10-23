import React from 'react';
import { render } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/dom';
import { MantineProvider, TextInput } from '@mantine/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DialogBody } from '@/components/shared/Dialog/DialogBody';
import { PolishedFormTemplate } from '../PolishedFormTemplate';

beforeAll(() => {
  vi.stubGlobal('React', React);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Entry form layout', () => {
  it('keeps long polished form content at natural height', () => {
    render(
      <MantineProvider>
        <PolishedFormTemplate
          opened
          onClose={vi.fn()}
          title="Entry form"
          bodyClassName="entry-form-body"
          primaryAction={{ label: 'Save', onClick: vi.fn() }}
        >
          <div style={{ minHeight: 1200 }}>
            <TextInput label="Description" />
          </div>
        </PolishedFormTemplate>
      </MantineProvider>
    );

    const body = screen
      .getByLabelText('Description')
      .closest('.entry-form-body');
    expect(body).not.toBeNull();
    expect(body).toHaveStyle({ width: '100%' });
    expect((body as HTMLElement).style.maxHeight).toBe('');
    expect((body as HTMLElement).style.overflowY).toBe('');
    expect((body as HTMLElement).style.overflowX).toBe('');
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  it('preserves footer actions and field helpers', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <MantineProvider>
        <PolishedFormTemplate
          opened
          onClose={onCancel}
          title="Entry form"
          primaryAction={{ label: 'Save', onClick: onSave }}
          secondaryAction={{ label: 'Cancel', onClick: onCancel }}
        >
          {({ getFieldProps }) => {
            const field = getFieldProps('description');
            return (
              <TextInput
                label="Description"
                styles={field.styles}
                {...field.handlers}
              />
            );
          }}
        </PolishedFormTemplate>
      </MantineProvider>
    );

    fireEvent.focus(screen.getByLabelText('Description'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('leaves standard dialog bodies unbounded by default', () => {
    render(
      <MantineProvider>
        <DialogBody>
          <span>Entry fields</span>
        </DialogBody>
      </MantineProvider>
    );

    const body = screen.getByText('Entry fields').parentElement;
    expect(body?.style.maxHeight).toBe('');
    expect(body?.style.overflowY).toBe('');
  });

  it('retains opt-in scrolling for non-entry data views', () => {
    render(
      <MantineProvider>
        <DialogBody maxHeight={240}>
          <span>Preview rows</span>
        </DialogBody>
      </MantineProvider>
    );

    expect(screen.getByText('Preview rows').parentElement).toHaveStyle({
      maxHeight: '240px',
      overflowY: 'auto',
    });
  });
});
