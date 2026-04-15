import {
  AiLogicAgentLoopStepSchema,
  AiUiAgentLoopStepSchema,
  AI_DEFAULT_STYLE
} from '../src';

describe('Agent loop schemas', () => {
  it('accepts logic continue step', () => {
    const value = {
      action: 'continue',
      nextStepPrompt: 'Create input constants for tax rate and subtotal.',
      reason: 'These inputs are required before composing downstream arithmetic nodes.'
    };

    const parsed = AiLogicAgentLoopStepSchema.safeParse(value);
    expect(parsed.success).toBe(true);
  });

  it('accepts logic stop step with final result', () => {
    const value = {
      action: 'stop',
      reason: 'The flow is complete and satisfies the goal.',
      result: {
        nodes: [
          {
            kind: 'dummy',
            tempId: 'n1',
            label: 'Subtotal',
            sampleType: 'decimal',
            sampleValue: 100
          },
          {
            kind: 'dummy',
            tempId: 'n2',
            label: 'Tax rate',
            sampleType: 'decimal',
            sampleValue: 0.15
          },
          {
            kind: 'arithmetic',
            tempId: 'n3',
            label: 'Tax amount',
            operation: 'multiply',
            operands: [{ label: 'A' }, { label: 'B' }]
          }
        ],
        edges: [
          { fromNode: 'n1', toNode: 'n3', toSlot: 0 },
          { fromNode: 'n2', toNode: 'n3', toSlot: 1 }
        ],
        summary: 'Computes tax amount from subtotal and tax rate.'
      }
    };

    const parsed = AiLogicAgentLoopStepSchema.safeParse(value);
    expect(parsed.success).toBe(true);
  });

  it('rejects continue step without nextStepPrompt', () => {
    const value = {
      action: 'continue',
      reason: 'Need one more step.'
    };

    const parsed = AiLogicAgentLoopStepSchema.safeParse(value);
    expect(parsed.success).toBe(false);
  });

  it('accepts ui stop step with final result', () => {
    const value = {
      action: 'stop',
      reason: 'UI is complete and ready.',
      result: {
        sections: [
          {
            type: 'Section',
            backgroundColor: '#FFFFFF',
            style: AI_DEFAULT_STYLE,
            children: [
              {
                type: 'Heading',
                content: 'Welcome',
                size: 'h1',
                style: AI_DEFAULT_STYLE
              }
            ]
          }
        ],
        summary: 'Single hero section with heading.'
      }
    };

    const parsed = AiUiAgentLoopStepSchema.safeParse(value);
    expect(parsed.success).toBe(true);
  });

  it('rejects ui stop step without result', () => {
    const value = {
      action: 'stop',
      reason: 'done'
    };

    const parsed = AiUiAgentLoopStepSchema.safeParse(value);
    expect(parsed.success).toBe(false);
  });
});
