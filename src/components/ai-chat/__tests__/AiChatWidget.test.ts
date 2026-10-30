import { describe, expect, it } from 'vitest';
import { resolveInitialChatScope } from '../AiChatWidget';

describe('chat business scope defaults', () => {
  it('defaults to Clothing for new sessions and legacy All selections', () => {
    expect(resolveInitialChatScope(null, null)).toBe('clothing');
    expect(resolveInitialChatScope(null, 'ALL')).toBe('clothing');
    expect(resolveInitialChatScope('invalid', 'ALL')).toBe('clothing');
  });
  it('preserves explicit business scopes and future All selections', () => {
    expect(resolveInitialChatScope(null, 'trucking')).toBe('trucking');
    expect(resolveInitialChatScope(null, 'general-merchandise')).toBe(
      'general-merchandise'
    );
    expect(resolveInitialChatScope('ALL', 'clothing')).toBe('ALL');
  });
});
