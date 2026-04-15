import { z } from 'zod';
import { AiLogicGenerationResultSchema } from './logic-generation';
import { AiUiGenerationResultSchema } from './ui-generation';

const AgentLoopContinueSchema = z.object({
  action: z.literal('continue'),
  nextStepPrompt: z
    .string()
    .min(3)
    .max(2000)
    .describe(
      'The single, necessary next-step prompt for the next model call. Do not provide recommendations or alternatives.'
    ),
  reason: z
    .string()
    .min(3)
    .max(500)
    .describe('Short explanation of why this step is strictly necessary before finishing')
});

const AgentLoopStopSchema = z.object({
  action: z.literal('stop'),
  reason: z
    .string()
    .min(3)
    .max(500)
    .describe('Why the goal is complete and no additional steps are needed')
});

export const AiLogicAgentLoopStepSchema = z.discriminatedUnion('action', [
  AgentLoopContinueSchema,
  AgentLoopStopSchema.extend({
    result: AiLogicGenerationResultSchema.describe('Final structured logic output')
  })
]);

export type AiLogicAgentLoopStep = z.infer<typeof AiLogicAgentLoopStepSchema>;

export const AiUiAgentLoopStepSchema = z.discriminatedUnion('action', [
  AgentLoopContinueSchema,
  AgentLoopStopSchema.extend({
    result: AiUiGenerationResultSchema.describe('Final structured UI output')
  })
]);

export type AiUiAgentLoopStep = z.infer<typeof AiUiAgentLoopStepSchema>;
