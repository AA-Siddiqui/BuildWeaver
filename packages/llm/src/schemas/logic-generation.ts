import { z } from 'zod';

// ── Individual AI node schemas ─────────────────────────────────────

const AiDummyNode = z.object({
  kind: z.literal('dummy'),
  tempId: z.string().describe('Temporary ID for edge references'),
  label: z.string().describe('Short label for the node'),
  description: z.string().optional().describe('Optional description'),
  sampleType: z.enum(['integer', 'decimal', 'string', 'boolean']).describe('Type of sample value'),
  sampleValue: z.union([z.number(), z.string(), z.boolean()]).describe('The sample value to output')
});

const AiArithmeticOperand = z.object({
  label: z.string().describe('Operand label (e.g. "Input A")'),
  sampleValue: z.number().nullable().optional().describe('Optional sample number')
});

const AiArithmeticNode = z.object({
  kind: z.literal('arithmetic'),
  tempId: z.string(),
  label: z.string(),
  description: z.string().optional(),
  operation: z.enum(['add', 'subtract', 'multiply', 'divide', 'exponent', 'modulo', 'average', 'min', 'max']),
  operands: z.array(AiArithmeticOperand).min(2).max(8).describe('At least two operands')
});

const AiStringInput = z.object({
  label: z.string(),
  sampleValue: z.string().optional(),
  role: z.enum(['text', 'delimiter', 'search', 'replace', 'start', 'end']).optional()
});

const AiStringNode = z.object({
  kind: z.literal('string'),
  tempId: z.string(),
  label: z.string(),
  description: z.string().optional(),
  operation: z.enum(['concat', 'uppercase', 'lowercase', 'trim', 'slice', 'replace', 'length']),
  inputs: z.array(AiStringInput).min(1).max(6)
});

const AiListNode = z.object({
  kind: z.literal('list'),
  tempId: z.string(),
  label: z.string(),
  description: z.string().optional(),
  operation: z.enum(['append', 'merge', 'slice', 'unique', 'sort', 'length', 'map', 'filter', 'reduce'])
});

const AiObjectNode = z.object({
  kind: z.literal('object'),
  tempId: z.string(),
  label: z.string(),
  description: z.string().optional(),
  operation: z.enum(['merge', 'pick', 'set', 'get', 'keys', 'values'])
});

const AiConditionalNode = z.object({
  kind: z.literal('conditional'),
  tempId: z.string(),
  label: z.string(),
  description: z.string().optional()
});

const AiLogicalNode = z.object({
  kind: z.literal('logical'),
  tempId: z.string(),
  label: z.string(),
  description: z.string().optional(),
  operation: z.enum(['and', 'or', 'not'])
});

const AiRelationalNode = z.object({
  kind: z.literal('relational'),
  tempId: z.string(),
  label: z.string(),
  description: z.string().optional(),
  operation: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq'])
});

// ── Discriminated union of all AI node types ───────────────────────

export const AiNodeSchema = z.discriminatedUnion('kind', [
  AiDummyNode,
  AiArithmeticNode,
  AiStringNode,
  AiListNode,
  AiObjectNode,
  AiConditionalNode,
  AiLogicalNode,
  AiRelationalNode
]);

export type AiNode = z.infer<typeof AiNodeSchema>;

// ── AI edge schema ─────────────────────────────────────────────────

export const AiEdgeSchema = z.object({
  fromNode: z.string().describe('tempId of the source node'),
  toNode: z.string().describe('tempId of the target node'),
  toSlot: z.number().int().min(0).max(7).describe(
    'Index of the target input slot (0-based). Slot mapping per kind: ' +
    'arithmetic/string: operand/input index; ' +
    'list: 0=primary 1=secondary; ' +
    'object: 0=source 1=patch; ' +
    'conditional: 0=condition 1=true-branch 2=false-branch; ' +
    'logical: 0=primary 1=secondary; ' +
    'relational: 0=left 1=right'
  )
});

export type AiEdge = z.infer<typeof AiEdgeSchema>;

// ── Top-level generation result ────────────────────────────────────

export const AiLogicGenerationResultSchema = z.object({
  nodes: z.array(AiNodeSchema).min(1).max(20).describe('The logic nodes to create'),
  edges: z.array(AiEdgeSchema).max(40).describe('Connections between nodes'),
  summary: z.string().describe('One-sentence description of what was generated')
});

export type AiLogicGenerationResult = z.infer<typeof AiLogicGenerationResultSchema>;
