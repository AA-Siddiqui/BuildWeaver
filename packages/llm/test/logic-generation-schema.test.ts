import { AiLogicGenerationResultSchema } from '../src/schemas/logic-generation';
import type { AiLogicGenerationResult } from '../src/schemas/logic-generation';

describe('AiLogicGenerationResultSchema', () => {
  it('should accept a valid arithmetic + relational graph', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        {
          kind: 'arithmetic',
          tempId: 'n1',
          label: 'Add numbers',
          operation: 'add',
          operands: [
            { label: 'A', sampleValue: 10 },
            { label: 'B', sampleValue: 20 }
          ]
        },
        {
          kind: 'relational',
          tempId: 'n2',
          label: 'Check > 100',
          operation: 'gt'
        }
      ],
      edges: [{ fromNode: 'n1', toNode: 'n2', toSlot: 0 }],
      summary: 'Adds two numbers and checks if result is greater than 100'
    };

    const result = AiLogicGenerationResultSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept a valid dummy node', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        {
          kind: 'dummy',
          tempId: 'n1',
          label: 'Constant',
          sampleType: 'integer',
          sampleValue: 42
        }
      ],
      edges: [],
      summary: 'Constant value node'
    };

    expect(AiLogicGenerationResultSchema.safeParse(input).success).toBe(true);
  });

  it('should accept string node with inputs', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        {
          kind: 'string',
          tempId: 'n1',
          label: 'Concat names',
          operation: 'concat',
          inputs: [
            { label: 'First', sampleValue: 'John', role: 'text' },
            { label: 'Last', sampleValue: 'Doe', role: 'text' }
          ]
        }
      ],
      edges: [],
      summary: 'Concatenates first and last name'
    };

    expect(AiLogicGenerationResultSchema.safeParse(input).success).toBe(true);
  });

  it('should accept all node kinds', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'n1', label: 'X', sampleType: 'boolean', sampleValue: true },
        { kind: 'arithmetic', tempId: 'n2', label: 'X', operation: 'add', operands: [{ label: 'A' }, { label: 'B' }] },
        { kind: 'string', tempId: 'n3', label: 'X', operation: 'concat', inputs: [{ label: 'T' }] },
        { kind: 'list', tempId: 'n4', label: 'X', operation: 'append' },
        { kind: 'object', tempId: 'n5', label: 'X', operation: 'merge' },
        { kind: 'conditional', tempId: 'n6', label: 'X' },
        { kind: 'logical', tempId: 'n7', label: 'X', operation: 'and' },
        { kind: 'relational', tempId: 'n8', label: 'X', operation: 'eq' }
      ],
      edges: [],
      summary: 'All node types'
    };

    expect(AiLogicGenerationResultSchema.safeParse(input).success).toBe(true);
  });

  it('should reject empty nodes array', () => {
    const input = {
      nodes: [],
      edges: [],
      summary: ''
    };

    expect(AiLogicGenerationResultSchema.safeParse(input).success).toBe(false);
  });

  it('should reject unknown node kind', () => {
    const input = {
      nodes: [{ kind: 'unknown', tempId: 'n1', label: 'Bad' }],
      edges: [],
      summary: ''
    };

    expect(AiLogicGenerationResultSchema.safeParse(input).success).toBe(false);
  });

  it('should reject arithmetic node with fewer than 2 operands', () => {
    const input = {
      nodes: [
        {
          kind: 'arithmetic',
          tempId: 'n1',
          label: 'Bad',
          operation: 'add',
          operands: [{ label: 'Only one' }]
        }
      ],
      edges: [],
      summary: ''
    };

    expect(AiLogicGenerationResultSchema.safeParse(input).success).toBe(false);
  });

  it('should reject edge with negative toSlot', () => {
    const input = {
      nodes: [
        { kind: 'dummy', tempId: 'n1', label: 'X', sampleType: 'integer', sampleValue: 1 }
      ],
      edges: [{ fromNode: 'n1', toNode: 'n1', toSlot: -1 }],
      summary: ''
    };

    expect(AiLogicGenerationResultSchema.safeParse(input).success).toBe(false);
  });
});
