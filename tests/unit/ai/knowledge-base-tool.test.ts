import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_BASE_TOOL } from '@/lib/ai/tools/knowledge-base-tool';
import type { AiToolExecutionContext } from '@/lib/ai/types';

describe('KNOWLEDGE_BASE_TOOL (searchKnowledgeBaseAndSOPs)', () => {
  const validContext: AiToolExecutionContext = {
    userId: 'usr_test',
    userRole: 'ADMIN',
    allowedBusinessUnits: ['clothing', 'trucking', 'general-merchandise'],
    accessibleModules: ['/clothing', '/trucking', '/general-merchandise'],
  };

  const clothingOnlyContext: AiToolExecutionContext = {
    userId: 'usr_clothing',
    userRole: 'USER',
    allowedBusinessUnits: ['clothing'],
    accessibleModules: ['/clothing'],
  };

  it('rejects access if the user lacks permissions for the business unit', async () => {
    await expect(
      KNOWLEDGE_BASE_TOOL.execute(
        { query: 'payment due date', businessUnit: 'trucking' },
        clothingOnlyContext
      )
    ).rejects.toThrow(/Access denied/i);
  });

  it.each(['trucking', 'general-merchandise'])(
    'does not serve Clothing policies as %s policies even to an administrator',
    async (businessUnit) => {
      await expect(
        KNOWLEDGE_BASE_TOOL.execute(
          { query: 'payment due date', businessUnit },
          validContext
        )
      ).rejects.toThrow(/available only for clothing/i);
    }
  );

  it('returns core policies, pre-approved message templates, and handbook procedures for late payment queries', async () => {
    const result = (await KNOWLEDGE_BASE_TOOL.execute(
      {
        query: 'what to do if customer did not pay on time?',
        businessUnit: 'clothing',
      },
      validContext
    )) as {
      businessUnit: string;
      corePolicies: Array<{ topic: string; rule: string }>;
      preApprovedMessageTemplates: Array<{ id: string; title: string }>;
      handbookProcedures: Array<{ id: string; title: string }>;
    };

    expect(result.businessUnit).toBe('clothing');
    expect(result.corePolicies.length).toBeGreaterThan(0);
    expect(result.preApprovedMessageTemplates.length).toBeGreaterThan(0);
    expect(result.handbookProcedures.length).toBeGreaterThan(0);

    // Verify key late payment rules are surfaced
    const coreTopics = result.corePolicies.map((p) => p.topic);
    expect(coreTopics).toContain(
      'Step-by-Step SOP When Customer Did Not Pay On Time'
    );
    expect(coreTopics).toContain('Due Date Calculation & Cutoff');

    // Verify Payment Reminders template is ranked first
    const templateIds = result.preApprovedMessageTemplates.map((t) => t.id);
    expect(templateIds).toContain('payment-reminders');

    // Verify handbook procedures include F04/F05
    const procIds = result.handbookProcedures.map((p) => p.id);
    expect(procIds).toEqual(expect.arrayContaining(['F05', 'F04']));
  });

  it('returns cancellation and deposit forfeiture rules for cancellation queries', async () => {
    const result = (await KNOWLEDGE_BASE_TOOL.execute(
      {
        query: 'can we refund the reservation deposit on cancellation?',
        businessUnit: 'clothing',
      },
      validContext
    )) as {
      corePolicies: Array<{ topic: string; rule: string }>;
      preApprovedMessageTemplates: Array<{ id: string; title: string }>;
      handbookProcedures: Array<{ id: string; title: string }>;
    };

    const coreTopics = result.corePolicies.map((p) => p.topic);
    expect(coreTopics).toContain(
      'Cancellation with Money Collected (Reservation Deposit vs Installments)'
    );

    // Verify cancellation templates are returned
    const templateIds = result.preApprovedMessageTemplates.map((t) => t.id);
    expect(templateIds.some((id) => id.startsWith('cancellation-'))).toBe(true);

    // Verify E13 procedure is matched
    const procIds = result.handbookProcedures.map((p) => p.id);
    expect(procIds).toContain('E13');
  });

  it('is registered as a read-only tool with correct parameters schema', () => {
    expect(KNOWLEDGE_BASE_TOOL.readOnly).toBe(true);
    expect(KNOWLEDGE_BASE_TOOL.businessUnits).toEqual(['clothing']);
    expect(KNOWLEDGE_BASE_TOOL.name).toBe('searchKnowledgeBaseAndSOPs');
    expect(KNOWLEDGE_BASE_TOOL.parameters.required).toContain('query');
  });
});
