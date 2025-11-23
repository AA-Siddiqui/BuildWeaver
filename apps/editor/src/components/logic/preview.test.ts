import {
  evaluateArithmeticPreview,
  evaluateDummyPreview,
  evaluateListPreview,
  evaluateObjectPreview,
  evaluateStringPreview
} from './preview';
import {
  ArithmeticNodeData,
  DummyNodeData,
  ListNodeData,
  ObjectNodeData,
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
        { id: 'a', label: 'A', sampleValue: 'Hello' },
        { id: 'b', label: 'B', sampleValue: 'World' }
      ],
      options: { delimiter: ' ' }
    };

    expect(evaluateStringPreview(stringNode)).toMatchObject({ summary: 'Hello World', state: 'ready' });
  });

  it('limits list preview samples to five entries', () => {
    const listNode: ListNodeData = {
      kind: 'list',
      label: 'List',
      description: 'Append',
      operation: 'append',
      primarySample: [1, 2, 3, 4, 5, 6],
      secondarySample: [7, 8, 9],
      limit: 5
    };

    const preview = evaluateListPreview(listNode);
    expect(preview.state).toBe('ready');
    expect(preview.summary).toContain('1');
    expect(preview.summary).not.toContain('7');
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
});
