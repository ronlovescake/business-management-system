declare module '@testing-library/react' {
  import type { ReactElement } from 'react';

  export interface RenderHookResult<T> {
    result: { current: T };
  }

  export function renderHook<T>(callback: () => T): RenderHookResult<T>;
  export function act(callback: () => void | Promise<void>): Promise<void>;
  export function waitFor<T>(callback: () => T | Promise<T>): Promise<void>;
  export function cleanup(): void;
  export function render(ui: ReactElement): unknown;
}
