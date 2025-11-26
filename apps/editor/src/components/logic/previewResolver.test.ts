import type { Edge, Node } from 'reactflow';
import type {
  LogicEditorNodeData,
  LogicEditorNode,
  LogicEditorEdge,
  DummyNodeData,
  StringNodeData,
  ListNodeData,
  ConditionalNodeData,
  FunctionArgumentNodeData,
  FunctionReturnNodeData,
  FunctionNodeData,
  LogicalOperatorNodeData,
  UserDefinedFunction
} from '@buildweaver/libs';
import { createPreviewResolver } from './previewResolver';
import { getConditionalHandleId } from './conditionalHandles';
import { getLogicalHandleId } from './logicalOperatorConfig';

describe('previewResolver', () => {
  const basePosition = { x: 0, y: 0 };

  it('uses upstream values when computing previews', () => {
    const stringInputId = 'input-a';
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'dummy-1',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'Sample string',
          description: 'source',
          sample: { type: 'string', value: 'hello world' }
        } satisfies DummyNodeData
      },
      {
        id: 'string-1',
        type: 'string',
        position: basePosition,
        data: {
          kind: 'string',
          label: 'Upper',
          operation: 'uppercase',
          stringInputs: [{ id: stringInputId, label: 'Primary', sampleValue: '' }],
          options: {}
        } satisfies StringNodeData
      }
    ];

    const edges: Edge[] = [
      {
        id: 'edge-1',
        source: 'dummy-1',
        target: 'string-1',
        sourceHandle: 'dummy-output',
        targetHandle: `string-${stringInputId}`
      }
    ];

    const resolver = createPreviewResolver(nodes, edges);
    const preview = resolver.getNodePreview('string-1');
    expect(preview.summary).toBe('HELLO WORLD');

    const binding = resolver.getHandleBinding('string-1', `string-${stringInputId}`);
    expect(binding?.sourceLabel).toBe('Sample string');
    expect(binding?.value).toBe('hello world');
  });

  it('merges list bindings across primary and secondary handles', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'dummy-primary',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'Primary list',
          sample: { type: 'list', value: [1, 2, 3] }
        } satisfies DummyNodeData
      },
      {
        id: 'dummy-secondary',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'Secondary list',
          sample: { type: 'list', value: [4, 5] }
        } satisfies DummyNodeData
      },
      {
        id: 'list-1',
        type: 'list',
        position: basePosition,
        data: {
          kind: 'list',
          label: 'Appender',
          operation: 'append',
          primarySample: [],
          secondarySample: [],
          sort: 'asc'
        } satisfies ListNodeData
      }
    ];

    const edges: Edge[] = [
      {
        id: 'edge-a',
        source: 'dummy-primary',
        target: 'list-1',
        sourceHandle: 'dummy-output',
        targetHandle: 'list-list-1-primary'
      },
      {
        id: 'edge-b',
        source: 'dummy-secondary',
        target: 'list-1',
        sourceHandle: 'dummy-output',
        targetHandle: 'list-list-1-secondary'
      }
    ];

    const resolver = createPreviewResolver(nodes, edges);
    const preview = resolver.getNodePreview('list-1');
    expect(preview.value).toEqual([1, 2, 3, 4, 5]);
  });

  it('uses numeric bindings for list slice indices', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'dummy-list',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'List source',
          sample: { type: 'list', value: [10, 11, 12, 13] }
        } satisfies DummyNodeData
      },
      {
        id: 'dummy-start',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'Start index',
          sample: { type: 'integer', value: 1 }
        } satisfies DummyNodeData
      },
      {
        id: 'dummy-end',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'End index',
          sample: { type: 'integer', value: 3 }
        } satisfies DummyNodeData
      },
      {
        id: 'list-slice',
        type: 'list',
        position: basePosition,
        data: {
          kind: 'list',
          label: 'Slicer',
          operation: 'slice',
          primarySample: [],
          secondarySample: [],
          startSample: 0,
          endSample: 0,
          sort: 'asc'
        } satisfies ListNodeData
      }
    ];

    const edges: Edge[] = [
      {
        id: 'edge-primary',
        source: 'dummy-list',
        target: 'list-slice',
        sourceHandle: 'dummy-out',
        targetHandle: 'list-list-slice-primary'
      },
      {
        id: 'edge-start',
        source: 'dummy-start',
        target: 'list-slice',
        sourceHandle: 'dummy-out',
        targetHandle: 'list-list-slice-start'
      },
      {
        id: 'edge-end',
        source: 'dummy-end',
        target: 'list-slice',
        sourceHandle: 'dummy-out',
        targetHandle: 'list-list-slice-end'
      }
    ];

    const resolver = createPreviewResolver(nodes, edges);
    const preview = resolver.getNodePreview('list-slice');
    expect(preview.value).toEqual([11, 12]);
  });

  it('marks target handles unavailable once a connection exists', () => {
    const resolver = createPreviewResolver([], [
      { id: 'edge-1', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' }
    ]);

    expect(resolver.isHandleAvailable({ target: 'b', targetHandle: 'in' })).toBe(false);
    expect(resolver.isHandleAvailable({ target: 'b', targetHandle: 'other' })).toBe(true);
  });

  it('evaluates conditional nodes using upstream bindings', () => {
    const conditionalId = 'conditional-node';
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'condition-source',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'Condition',
          sample: { type: 'boolean', value: true }
        } satisfies DummyNodeData
      },
      {
        id: 'true-source',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'True branch',
          sample: { type: 'string', value: 'truthy-value' }
        } satisfies DummyNodeData
      },
      {
        id: 'false-source',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'False branch',
          sample: { type: 'string', value: 'falsy-value' }
        } satisfies DummyNodeData
      },
      {
        id: conditionalId,
        type: 'conditional',
        position: basePosition,
        data: {
          kind: 'conditional',
          label: 'Conditional',
          conditionSample: false,
          trueValue: 'fallback-true',
          falseValue: 'fallback-false',
          trueValueKind: 'string',
          falseValueKind: 'string'
        } satisfies ConditionalNodeData
      }
    ];

    const edges: Edge[] = [
      {
        id: 'edge-condition',
        source: 'condition-source',
        target: conditionalId,
        sourceHandle: 'dummy-output',
        targetHandle: getConditionalHandleId(conditionalId, 'condition')
      },
      {
        id: 'edge-truthy',
        source: 'true-source',
        target: conditionalId,
        sourceHandle: 'dummy-output',
        targetHandle: getConditionalHandleId(conditionalId, 'truthy')
      },
      {
        id: 'edge-falsy',
        source: 'false-source',
        target: conditionalId,
        sourceHandle: 'dummy-output',
        targetHandle: getConditionalHandleId(conditionalId, 'falsy')
      }
    ];

    const resolver = createPreviewResolver(nodes, edges);
    const preview = resolver.getNodePreview(conditionalId);
    expect(preview.summary).toContain('truthy-value');
  });

  it('supplies placeholder values for function argument nodes', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'function-argument-1',
        type: 'function-argument',
        position: basePosition,
        data: {
          kind: 'function-argument',
          argumentId: 'arg-1',
          name: 'Threshold',
          type: 'number'
        } satisfies FunctionArgumentNodeData
      }
    ];

    const resolver = createPreviewResolver(nodes, []);
    expect(resolver.getNodePreview('function-argument-1').value).toBe(0);
  });

  it('omits placeholder values for arguments when executing a function call', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'function-argument-1',
        type: 'function-argument',
        position: basePosition,
        data: {
          kind: 'function-argument',
          argumentId: 'arg-1',
          name: 'Threshold',
          type: 'number'
        } satisfies FunctionArgumentNodeData
      }
    ];

    const resolver = createPreviewResolver(nodes, [], { argumentValueOverrides: {} });
    expect(resolver.getNodePreview('function-argument-1').value).toBeUndefined();
  });

  it('exposes null values for applied functions without definitions', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'function-1',
        type: 'function',
        position: basePosition,
        data: {
          kind: 'function',
          functionId: 'fn-1',
          functionName: 'Score',
          mode: 'applied',
          returnsValue: true
        } satisfies FunctionNodeData
      },
      {
        id: 'logic-1',
        type: 'logical',
        position: basePosition,
        data: {
          kind: 'logical',
          label: 'Gate',
          description: '',
          operation: 'and',
          primarySample: true,
          secondarySample: false
        } satisfies LogicalOperatorNodeData
      }
    ];

    const edges: Edge[] = [
      {
        id: 'edge-connect',
        source: 'function-1',
        target: 'logic-1',
        sourceHandle: 'function-result',
        targetHandle: getLogicalHandleId('logic-1', 'primary')
      }
    ];

    const resolver = createPreviewResolver(nodes, edges);
    expect(resolver.getNodePreview('function-1').value).toBeNull();
    const binding = resolver.getHandleBinding('logic-1', getLogicalHandleId('logic-1', 'primary'));
    expect(binding?.sourceNodeId).toBe('function-1');
    expect(binding?.value).toBeNull();
  });

  it('evaluates applied function nodes using their definitions and bindings', () => {
    const functionDefinition: UserDefinedFunction = {
      id: 'fn-echo',
      name: 'Echo',
      description: 'Returns the provided number',
      nodes: [
        {
          id: 'arg-node',
          type: 'function-argument',
          position: basePosition,
          data: {
            kind: 'function-argument',
            argumentId: 'arg-input',
            name: 'Input',
            type: 'number'
          } satisfies FunctionArgumentNodeData
        },
        {
          id: 'return-node',
          type: 'function-return',
          position: basePosition,
          data: {
            kind: 'function-return',
            returnId: 'ret'
          } satisfies FunctionReturnNodeData
        }
      ] satisfies LogicEditorNode[],
      edges: [
        {
          id: 'edge-arg-return',
          source: 'arg-node',
          target: 'return-node',
          sourceHandle: 'function-argument-arg-input',
          targetHandle: 'function-return-ret'
        }
      ] satisfies LogicEditorEdge[],
      arguments: [{ id: 'arg-input', name: 'Input', type: 'number' }],
      returnsValue: true
    };

    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'dummy-source',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'Number source',
          sample: { type: 'integer', value: 42 }
        } satisfies DummyNodeData
      },
      {
        id: 'function-1',
        type: 'function',
        position: basePosition,
        data: {
          kind: 'function',
          functionId: 'fn-echo',
          functionName: 'Echo',
          mode: 'applied',
          returnsValue: true
        } satisfies FunctionNodeData
      },
      {
        id: 'logic-1',
        type: 'logical',
        position: basePosition,
        data: {
          kind: 'logical',
          label: 'Gate',
          description: '',
          operation: 'and',
          primarySample: true,
          secondarySample: true
        } satisfies LogicalOperatorNodeData
      }
    ];

    const edges: Edge[] = [
      {
        id: 'edge-arg',
        source: 'dummy-source',
        target: 'function-1',
        sourceHandle: 'dummy-output',
        targetHandle: 'arg-arg-input'
      },
      {
        id: 'edge-result',
        source: 'function-1',
        target: 'logic-1',
        sourceHandle: 'function-result',
        targetHandle: getLogicalHandleId('logic-1', 'primary')
      }
    ];

    const resolver = createPreviewResolver(nodes, edges, { functions: [functionDefinition] });
    const preview = resolver.getNodePreview('function-1');
    expect(preview.value).toBe(42);
    const binding = resolver.getHandleBinding('logic-1', getLogicalHandleId('logic-1', 'primary'));
    expect(binding?.value).toBe(42);
  });
});
