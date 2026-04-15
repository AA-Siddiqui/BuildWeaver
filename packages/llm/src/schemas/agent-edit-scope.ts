import { z } from 'zod';

const AgentPromptSchema = z
  .string()
  .min(3)
  .max(2000)
  .describe('Concrete execution prompt for the selected target. Must be directly actionable.');

export const AiAgentEditScopeSchema = z
  .object({
    applyUi: z
      .boolean()
      .describe('True when the request requires page UI creation or updates.'),
    applyLogic: z
      .boolean()
      .describe('True when the request requires logic-node or flow updates.'),
    reason: z
      .string()
      .min(3)
      .max(500)
      .describe('Short explanation for why the selected targets are required.'),
    uiPrompt: AgentPromptSchema.optional(),
    logicPrompt: AgentPromptSchema.optional()
  })
  .refine((value) => value.applyUi || value.applyLogic, {
    message: 'At least one target must be selected.'
  })
  .refine((value) => !value.applyUi || Boolean(value.uiPrompt), {
    message: 'uiPrompt is required when applyUi is true.',
    path: ['uiPrompt']
  })
  .refine((value) => !value.applyLogic || Boolean(value.logicPrompt), {
    message: 'logicPrompt is required when applyLogic is true.',
    path: ['logicPrompt']
  });

export type AiAgentEditScope = z.infer<typeof AiAgentEditScopeSchema>;
