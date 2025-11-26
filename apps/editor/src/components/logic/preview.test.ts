import {
  evaluateArithmeticPreview,
  evaluateConditionalPreview,
  evaluateDummyPreview,
  evaluateListPreview,
  evaluateLogicalOperatorPreview,
  evaluateObjectPreview,
  evaluateRelationalPreview,
  evaluateStringPreview
} from './preview';
import {
  ArithmeticNodeData,
  ConditionalNodeData,
  DummyNodeData,
  ListNodeData,
  LogicalOperatorNodeData,
  ObjectNodeData,
  RelationalOperatorNodeData,
  StringNodeData
} from '@buildweaver/libs';

describe('logic previews', () => {
  it('renders dummy previews for each sample type', () => {
    const dummy: DummyNodeData = {
      kind: 'dummy',
      label: 'Sample',
      description: 'Test',
      sample: { type: 'string', value: 'Hello' }
    };
    const preview = evaluateDummyPreview(dummy);
    expect(preview.state).toBe('ready');
    expect(preview.summary).toContain('Hello');
  });

  it('computes arithmetic preview when operands provided', () => {
    const arithmetic: ArithmeticNodeData = {
      kind: 'arithmetic',
      label: 'Math',
      description: 'Add',
      operation: 'add',
      precision: 2,
      operands: [
        { id: 'a', label: 'A', sampleValue: 10 },
        { id: 'b', label: 'B', sampleValue: 5 }
      ]
    };

    expect(evaluateArithmeticPreview(arithmetic)).toMatchObject({ summary: '15', state: 'ready' });
  });

  it('returns unknown arithmetic preview when missing sample', () => {
    const arithmetic: ArithmeticNodeData = {
      kind: 'arithmetic',
      label: 'Math',
      description: 'Add',
      operation: 'add',
      precision: 2,
      operands: [
        { id: 'a', label: 'A', sampleValue: 10 },
        { id: 'b', label: 'B', sampleValue: null }
      ]
    };

    expect(evaluateArithmeticPreview(arithmetic).state).toBe('unknown');
  });

  it('handles string concat preview', () => {
    const stringNode: StringNodeData = {
      kind: 'string',
      label: 'Strings',
      description: 'Concat',
      operation: 'concat',
      stringInputs: [
        { id: 'a', label: 'Text 1', role: 'text', sampleValue: 'Hello' },
        { id: 'b', label: 'Text 2', role: 'text', sampleValue: 'World' },
        { id: 'c', label: 'Delimiter', role: 'delimiter', sampleValue: ' ' }
      ]
    };

    expect(evaluateStringPreview(stringNode)).toMatchObject({ summary: 'Hello World', state: 'ready' });
  });

  it('replaces strings using dedicated inputs', () => {
    const stringNode: StringNodeData = {
      kind: 'string',
      label: 'Strings',
      description: 'Replace',
      operation: 'replace',
      stringInputs: [
        { id: 'text', label: 'Text', role: 'text', sampleValue: 'foo bar foo' },
        { id: 'search', label: 'Search', role: 'search', sampleValue: 'foo' },
        { id: 'replace', label: 'Replace', role: 'replace', sampleValue: 'baz' }
      ]
    };

    expect(evaluateStringPreview(stringNode)).toMatchObject({ summary: 'baz bar baz', state: 'ready' });
  });

  it('slices strings using node inputs for start and end', () => {
    const stringNode: StringNodeData = {
      kind: 'string',
      label: 'Strings',
      description: 'Slice',
      operation: 'slice',
      stringInputs: [
        { id: 'text', label: 'Text', role: 'text', sampleValue: 'BuildWeaver' },
        { id: 'start', label: 'Start', role: 'start', sampleValue: '5' },
        { id: 'end', label: 'End', role: 'end', sampleValue: '11' }
      ]
    };

    expect(evaluateStringPreview(stringNode)).toMatchObject({ summary: 'Weaver', state: 'ready' });
  });

  it('limits single-input operations to the primary sample', () => {
    const stringNode: StringNodeData = {
      kind: 'string',
      label: 'Strings',
      description: 'Uppercase',
      operation: 'uppercase',
      stringInputs: [
        { id: 'text', label: 'Text', role: 'text', sampleValue: 'hello' }
      ]
    };

    expect(evaluateStringPreview(stringNode)).toMatchObject({ summary: 'HELLO', state: 'ready' });
  });

  it('keeps the full list when previewing append operations', () => {
    const listNode: ListNodeData = {
      kind: 'list',
      label: 'List',
      description: 'Append',
      operation: 'append',
      primarySample: [1, 2, 3, 4, 5, 6],
      secondarySample: [7, 8, 9]
    };

    const preview = evaluateListPreview(listNode);
    expect(preview.state).toBe('ready');
    expect(preview.value).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('uses start/end samples for list slices', () => {
    const listNode: ListNodeData = {
      kind: 'list',
      label: 'List',
      description: 'Slice',
      operation: 'slice',
      primarySample: [10, 11, 12, 13, 14],
      startSample: 1,
      endSample: 3
    };

    const preview = evaluateListPreview(listNode);
    expect(preview.value).toEqual([11, 12]);
  });

  it('accepts sort order overrides from bindings', () => {
    const listNode: ListNodeData = {
      kind: 'list',
      label: 'List',
      description: 'Sort',
      operation: 'sort',
      primarySample: [3, 1, 2],
      sort: 'asc'
    };

    const preview = evaluateListPreview(listNode, { order: 'desc' });
    expect(preview.value).toEqual([3, 2, 1]);
  });

  it('merges objects for preview', () => {
    const objectNode: ObjectNodeData = {
      kind: 'object',
      label: 'Object',
      description: 'Merge',
      operation: 'merge',
      sourceSample: { status: 'idle' },
      patchSample: { status: 'done' }
    };

    const preview = evaluateObjectPreview(objectNode);
    expect(preview.summary).toContain('done');
    expect(preview.state).toBe('ready');
  });

  it('picks keys using overrides', () => {
    const objectNode: ObjectNodeData = {
      kind: 'object',
      label: 'Object',
      description: 'Pick',
      operation: 'pick',
      sourceSample: { a: 1, b: 2, c: 3 },
      selectedKeys: []
    };

    const preview = evaluateObjectPreview(objectNode, { selectedKeys: ['b', 'c'] });
    expect(preview.value).toEqual({ b: 2, c: 3 });
  });

  it('sets nested paths when provided', () => {
    const objectNode: ObjectNodeData = {
      kind: 'object',
      label: 'Object',
      description: 'Set',
      operation: 'set',
      sourceSample: { profile: { name: 'Ada' } },
      valueSample: '',
      valueSampleKind: 'string'
    };

    const preview = evaluateObjectPreview(objectNode, {
      path: 'profile.name',
      valueSample: 'Dana'
    });

    expect(preview.value).toEqual({ profile: { name: 'Dana' } });
  });

  it('gets nested values when path exists', () => {
    const objectNode: ObjectNodeData = {
      kind: 'object',
      label: 'Object',
      description: 'Get',
      operation: 'get',
      sourceSample: { a: { b: { c: 42 } } },
      path: ''
    };

    const preview = evaluateObjectPreview(objectNode, { path: 'a.b.c' });
    expect(preview.value).toBe(42);
  });

  it('evaluates conditional previews with overrides', () => {
    const conditionalNode: ConditionalNodeData = {
      kind: 'conditional',
      label: 'Branch',
      description: 'Test',
      conditionSample: false,
      trueValue: 'yes',
      falseValue: 'no'
    };

    const preview = evaluateConditionalPreview(conditionalNode, { condition: true, truthy: 'override' });
    expect(preview.state).toBe('ready');
    expect(preview.summary).toContain('override');
  });

  it('evaluates logical operator previews', () => {
    const logicalNode: LogicalOperatorNodeData = {
      kind: 'logical',
      label: 'Logic',
      description: 'Test',
      operation: 'and',
      primarySample: true,
      secondarySample: true
    };

    const andPreview = evaluateLogicalOperatorPreview(logicalNode);
    expect(andPreview.value).toBe(true);

    const notPreview = evaluateLogicalOperatorPreview({ ...logicalNode, operation: 'not', primarySample: false });
    expect(notPreview.value).toBe(true);
  });

  it('evaluates relational operator previews for numeric comparisons', () => {
    const relationalNode: RelationalOperatorNodeData = {
      kind: 'relational',
      label: 'Rel',
      description: 'Test',
      operation: 'gt',
      leftSample: 10,
      rightSample: 5,
      leftSampleKind: 'number',
      rightSampleKind: 'number'
    };

    const preview = evaluateRelationalPreview(relationalNode);
    expect(preview.value).toBe(true);

    const eqPreview = evaluateRelationalPreview({ ...relationalNode, operation: 'eq', leftSample: 'a', rightSample: 'a' });
    expect(eqPreview.value).toBe(true);
  });
});
