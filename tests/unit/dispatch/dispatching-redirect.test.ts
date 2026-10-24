import { describe, expect, it, vi } from 'vitest';
import DispatchingPage from '@/app/clothing/operations/dispatching/page';
const navigation = vi.hoisted(() => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));
vi.mock('next/navigation', () => navigation);

describe('legacy clothing dispatching route', () => {
  it('redirects to the real dispatch workflow without rendering sample operations', () => {
    expect(() => DispatchingPage()).toThrow('NEXT_REDIRECT');
    expect(navigation.redirect).toHaveBeenCalledWith(
      '/clothing/operations/dispatch'
    );
  });
});
