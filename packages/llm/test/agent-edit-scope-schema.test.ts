import { AiAgentEditScopeSchema } from '../src';

describe('AiAgentEditScopeSchema', () => {
  it('accepts a UI-only routing decision', () => {
    const parsed = AiAgentEditScopeSchema.safeParse({
      applyUi: true,
      applyLogic: false,
      reason: 'Prompt requests only page layout and content changes.',
      uiPrompt: 'Build a hero section with CTA and testimonials.'
    });

    expect(parsed.success).toBe(true);
  });

  it('accepts a combined UI+logic routing decision', () => {
    const parsed = AiAgentEditScopeSchema.safeParse({
      applyUi: true,
      applyLogic: true,
      reason: 'Prompt requires both checkout UI and validation logic.',
      uiPrompt: 'Create checkout form fields with inline error placeholders.',
      logicPrompt: 'Add validation and submit flow nodes for checkout fields.'
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects decisions with no selected targets', () => {
    const parsed = AiAgentEditScopeSchema.safeParse({
      applyUi: false,
      applyLogic: false,
      reason: 'No work.'
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects missing target prompt for selected UI edits', () => {
    const parsed = AiAgentEditScopeSchema.safeParse({
      applyUi: true,
      applyLogic: false,
      reason: 'Need UI updates only.'
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects missing target prompt for selected logic edits', () => {
    const parsed = AiAgentEditScopeSchema.safeParse({
      applyUi: false,
      applyLogic: true,
      reason: 'Need logic updates only.'
    });

    expect(parsed.success).toBe(false);
  });
});
