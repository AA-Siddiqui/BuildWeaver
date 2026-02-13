import { transformAiLogicOutput } from '../src/logic-transformer';
import type { AiLogicGenerationResult } from '../src/schemas/logic-generation';

describe('transformAiLogicOutput', () => {
  const logs: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  const logger = (message: string, meta?: Record<string, unknown>) => {
    logs.push({ message, meta });
  };

  beforeEach(() => {
    logs.length = 0;
  });

  it('should transform a single dummy node', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'n1', label: 'My Value', sampleType: 'integer', sampleValue: 42 }
      ],
      edges: [],
      summary: 'A constant value'
    };

    const result = transformAiLogicOutput(input, logger);

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
    expect(result.summary).toBe('A constant value');

    const node = result.nodes[0];
    expect(node.id).toMatch(/^dummy-/);
    expect(node.type).toBe('dummy');
    expect(node.data.kind).toBe('dummy');
    if (node.data.kind === 'dummy') {
      expect(node.data.label).toBe('My Value');
      expect(node.data.sample).toEqual({ type: 'integer', value: 42 });
    }
  });

  it('should transform arithmetic node with operands', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        {
          kind: 'arithmetic',
          tempId: 'n1',
          label: 'Add',
          operation: 'add',
          operands: [
            { label: 'Input A', sampleValue: 10 },
            { label: 'Input B', sampleValue: 20 }
          ]
        }
      ],
      edges: [],
      summary: 'Addition'
    };

    const result = transformAiLogicOutput(input);

    expect(result.nodes).toHaveLength(1);
    const node = result.nodes[0];
    expect(node.type).toBe('arithmetic');
    if (node.data.kind === 'arithmetic') {
      expect(node.data.operation).toBe('add');
      expect(node.data.operands).toHaveLength(2);
      expect(node.data.operands[0].label).toBe('Input A');
      expect(node.data.operands[0].sampleValue).toBe(10);
      expect(node.data.operands[0].id).toMatch(/^op-/);
    }
  });

  it('should transform string node with inputs', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        {
          kind: 'string',
          tempId: 'n1',
          label: 'Concat',
          operation: 'concat',
          inputs: [
            { label: 'First', sampleValue: 'Hello', role: 'text' },
            { label: 'Second', sampleValue: 'World', role: 'text' }
          ]
        }
      ],
      edges: [],
      summary: 'Concatenation'
    };

    const result = transformAiLogicOutput(input);

    expect(result.nodes).toHaveLength(1);
    const node = result.nodes[0];
    if (node.data.kind === 'string') {
      expect(node.data.operation).toBe('concat');
      expect(node.data.stringInputs).toHaveLength(2);
      expect(node.data.stringInputs[0].id).toMatch(/^str-/);
    }
  });

  it('should wire edges between connected nodes', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'n1', label: 'Value', sampleType: 'integer', sampleValue: 42 },
        {
          kind: 'arithmetic',
          tempId: 'n2',
          label: 'Double',
          operation: 'multiply',
          operands: [
            { label: 'Input', sampleValue: null },
            { label: 'Factor', sampleValue: 2 }
          ]
        }
      ],
      edges: [{ fromNode: 'n1', toNode: 'n2', toSlot: 0 }],
      summary: 'Double a value'
    };

    const result = transformAiLogicOutput(input, logger);

    expect(result.edges).toHaveLength(1);
    const edge = result.edges[0];
    expect(edge.source).toBe(result.nodes[0].id);
    expect(edge.target).toBe(result.nodes[1].id);
    expect(edge.sourceHandle).toBe('dummy-output');

    // Target handle should reference the first operand
    if (result.nodes[1].data.kind === 'arithmetic') {
      const expectedHandle = `operand-${result.nodes[1].data.operands[0].id}`;
      expect(edge.targetHandle).toBe(expectedHandle);
    }
  });

  it('should wire edges to relational node slots', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'n1', label: 'Left', sampleType: 'integer', sampleValue: 10 },
        { kind: 'dummy', tempId: 'n2', label: 'Right', sampleType: 'integer', sampleValue: 20 },
        { kind: 'relational', tempId: 'n3', label: 'Compare', operation: 'gt' }
      ],
      edges: [
        { fromNode: 'n1', toNode: 'n3', toSlot: 0 },
        { fromNode: 'n2', toNode: 'n3', toSlot: 1 }
      ],
      summary: 'Compare two values'
    };

    const result = transformAiLogicOutput(input, logger);

    expect(result.edges).toHaveLength(2);
    expect(result.edges[0].targetHandle).toBe(`relational-${result.nodes[2].id}-left`);
    expect(result.edges[1].targetHandle).toBe(`relational-${result.nodes[2].id}-right`);
  });

  it('should wire edges to conditional node slots', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'cond', label: 'Cond', sampleType: 'boolean', sampleValue: true },
        { kind: 'conditional', tempId: 'if', label: 'If/Else' }
      ],
      edges: [{ fromNode: 'cond', toNode: 'if', toSlot: 0 }],
      summary: 'Conditional'
    };

    const result = transformAiLogicOutput(input, logger);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].targetHandle).toBe(`conditional-${result.nodes[1].id}-condition`);
  });

  it('should wire edges to logical node slots', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'a', label: 'A', sampleType: 'boolean', sampleValue: true },
        { kind: 'logical', tempId: 'op', label: 'AND', operation: 'and' }
      ],
      edges: [{ fromNode: 'a', toNode: 'op', toSlot: 0 }],
      summary: 'Logical'
    };

    const result = transformAiLogicOutput(input, logger);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].targetHandle).toBe(`logical-${result.nodes[1].id}-primary`);
  });

  it('should wire edges to list node slots', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'src', label: 'List', sampleType: 'string', sampleValue: '[]' },
        { kind: 'list', tempId: 'lst', label: 'Merge', operation: 'merge' }
      ],
      edges: [{ fromNode: 'src', toNode: 'lst', toSlot: 0 }],
      summary: 'List merge'
    };

    const result = transformAiLogicOutput(input, logger);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].targetHandle).toBe(`list-${result.nodes[1].id}-primary`);
  });

  it('should wire edges to object node slots', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'src', label: 'Obj', sampleType: 'string', sampleValue: '{}' },
        { kind: 'object', tempId: 'obj', label: 'Merge', operation: 'merge' }
      ],
      edges: [{ fromNode: 'src', toNode: 'obj', toSlot: 1 }],
      summary: 'Object merge'
    };

    const result = transformAiLogicOutput(input, logger);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].targetHandle).toBe(`object-${result.nodes[1].id}-patch`);
  });

  it('should drop edges with dangling node references', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'n1', label: 'X', sampleType: 'integer', sampleValue: 0 }
      ],
      edges: [{ fromNode: 'n1', toNode: 'missing', toSlot: 0 }],
      summary: 'Bad edge'
    };

    const result = transformAiLogicOutput(input, logger);

    expect(result.edges).toHaveLength(0);
    expect(logs.some((l) => l.message.includes('dangling'))).toBe(true);
  });

  it('should drop edges with invalid slot indices', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'n1', label: 'From', sampleType: 'integer', sampleValue: 0 },
        { kind: 'relational', tempId: 'n2', label: 'To', operation: 'gt' }
      ],
      edges: [{ fromNode: 'n1', toNode: 'n2', toSlot: 99 }],
      summary: 'Bad slot'
    };

    const result = transformAiLogicOutput(input, logger);

    expect(result.edges).toHaveLength(0);
    expect(logs.some((l) => l.message.includes('invalid target slot'))).toBe(true);
  });

  it('should drop edges targeting dummy nodes (no inputs)', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'n1', label: 'A', sampleType: 'integer', sampleValue: 1 },
        { kind: 'dummy', tempId: 'n2', label: 'B', sampleType: 'integer', sampleValue: 2 }
      ],
      edges: [{ fromNode: 'n1', toNode: 'n2', toSlot: 0 }],
      summary: 'Dummy to dummy'
    };

    const result = transformAiLogicOutput(input, logger);

    expect(result.edges).toHaveLength(0);
  });

  it('should auto-layout nodes in a grid', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'n1', label: 'A', sampleType: 'integer', sampleValue: 1 },
        { kind: 'dummy', tempId: 'n2', label: 'B', sampleType: 'integer', sampleValue: 2 },
        { kind: 'dummy', tempId: 'n3', label: 'C', sampleType: 'integer', sampleValue: 3 },
        { kind: 'dummy', tempId: 'n4', label: 'D', sampleType: 'integer', sampleValue: 4 },
        { kind: 'dummy', tempId: 'n5', label: 'E', sampleType: 'integer', sampleValue: 5 },
        { kind: 'dummy', tempId: 'n6', label: 'F', sampleType: 'integer', sampleValue: 6 }
      ],
      edges: [],
      summary: 'Grid test'
    };

    const result = transformAiLogicOutput(input);

    // First 5 in column 0, 6th in column 1
    expect(result.nodes[0].position.x).toBe(0);
    expect(result.nodes[0].position.y).toBe(0);
    expect(result.nodes[4].position.x).toBe(0);
    expect(result.nodes[4].position.y).toBe(220 * 4);
    expect(result.nodes[5].position.x).toBe(320);
    expect(result.nodes[5].position.y).toBe(0);
  });

  it('should generate unique IDs for each node', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'n1', label: 'A', sampleType: 'integer', sampleValue: 1 },
        { kind: 'dummy', tempId: 'n2', label: 'B', sampleType: 'integer', sampleValue: 2 }
      ],
      edges: [],
      summary: 'ID test'
    };

    const result = transformAiLogicOutput(input);

    expect(result.nodes[0].id).not.toBe(result.nodes[1].id);
    expect(result.nodes[0].id).not.toBe('n1');
  });

  it('should set correct source handles based on node kind', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'n1', label: 'D', sampleType: 'integer', sampleValue: 1 },
        {
          kind: 'arithmetic',
          tempId: 'n2',
          label: 'A',
          operation: 'add',
          operands: [{ label: 'X' }, { label: 'Y' }]
        },
        { kind: 'relational', tempId: 'n3', label: 'R', operation: 'gt' }
      ],
      edges: [
        { fromNode: 'n1', toNode: 'n2', toSlot: 0 },
        { fromNode: 'n2', toNode: 'n3', toSlot: 0 }
      ],
      summary: 'Source handle test'
    };

    const result = transformAiLogicOutput(input, logger);

    // Dummy output handle
    expect(result.edges[0].sourceHandle).toBe('dummy-output');
    // Arithmetic output handle
    expect(result.edges[1].sourceHandle).toBe(`arithmetic-${result.nodes[1].id}-out`);
  });

  it('should build all node data kinds correctly', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'list', tempId: 'n1', label: 'List', operation: 'append' },
        { kind: 'object', tempId: 'n2', label: 'Obj', operation: 'merge' },
        { kind: 'conditional', tempId: 'n3', label: 'If' },
        { kind: 'logical', tempId: 'n4', label: 'And', operation: 'and' }
      ],
      edges: [],
      summary: 'All kinds'
    };

    const result = transformAiLogicOutput(input);

    expect(result.nodes[0].data.kind).toBe('list');
    expect(result.nodes[1].data.kind).toBe('object');
    expect(result.nodes[2].data.kind).toBe('conditional');
    expect(result.nodes[3].data.kind).toBe('logical');
  });

  it('should handle dummy sample types correctly', () => {
    const input: AiLogicGenerationResult = {
      nodes: [
        { kind: 'dummy', tempId: 'n1', label: 'Dec', sampleType: 'decimal', sampleValue: 3.14 },
        { kind: 'dummy', tempId: 'n2', label: 'Str', sampleType: 'string', sampleValue: 'hello' },
        { kind: 'dummy', tempId: 'n3', label: 'Bool', sampleType: 'boolean', sampleValue: false }
      ],
      edges: [],
      summary: 'Sample types'
    };

    const result = transformAiLogicOutput(input);

    if (result.nodes[0].data.kind === 'dummy') {
      expect(result.nodes[0].data.sample).toEqual({ type: 'decimal', value: 3.14 });
    }
    if (result.nodes[1].data.kind === 'dummy') {
      expect(result.nodes[1].data.sample).toEqual({ type: 'string', value: 'hello' });
    }
    if (result.nodes[2].data.kind === 'dummy') {
      expect(result.nodes[2].data.sample).toEqual({ type: 'boolean', value: false });
    }
  });
});
