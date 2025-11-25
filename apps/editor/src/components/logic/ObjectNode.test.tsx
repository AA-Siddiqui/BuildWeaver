import { fireEvent, render, screen } from '@testing-library/react';
import { NodeProps, ReactFlowProvider } from 'reactflow';
import { ObjectNodeData } from '@buildweaver/libs';
import { ObjectNode } from './ObjectNode';
import { PreviewResolverProvider, createPreviewResolver } from './previewResolver';
import { logicLogger } from '../../lib/logger';

describe('ObjectNode component', () => {
  const baseData: ObjectNodeData = {
    kind: 'object',
    label: 'Object block',
    description: 'Test node',
    operation: 'merge',
    sourceSample: { status: 'idle', attempts: 0 },
    patchSample: { status: 'ready' },
    selectedKeys: [],
    path: '',
    valueSample: '',
    valueSampleKind: 'string'
  };

  const renderNode = (overrides: Partial<ObjectNodeData> = {}) => {
    const resolver = createPreviewResolver([], []);
    const props = {
      id: 'object-node',
      data: { ...baseData, ...overrides },
      selected: false
    } as unknown as NodeProps<ObjectNodeData>;

    return render(
      <ReactFlowProvider>
        <PreviewResolverProvider resolver={resolver}>
          <ObjectNode {...props} />
        </PreviewResolverProvider>
      </ReactFlowProvider>
    );
  };

  it('renders attribute editors for merge operation', () => {
    renderNode();
    expect(screen.getAllByText('Add attribute')).toHaveLength(2);
  });

  it('exposes keys textarea for pick operation', () => {
    renderNode({ operation: 'pick' });
    expect(screen.getByPlaceholderText('Enter one key per line')).toBeInTheDocument();
  });

  it('keeps trailing newline characters while editing pick keys', () => {
    renderNode({ operation: 'pick' });
    const textarea = screen.getByPlaceholderText('Enter one key per line') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'status\n' } });

    expect(textarea.value).toBe('status\n');
  });

  it('shows scalar value input for set operation', () => {
    renderNode({ operation: 'set' });
    expect(screen.getByLabelText('Value type')).toBeInTheDocument();
  });

  it('retains selected value type while editing numeric samples', () => {
    const debugSpy = jest.spyOn(logicLogger, 'debug');
    renderNode({ operation: 'set' });
    const typeSelect = screen.getByLabelText('Value type') as HTMLSelectElement;

    fireEvent.change(typeSelect, { target: { value: 'number' } });

    const valueInput = screen.getByLabelText('Numeric value') as HTMLInputElement;
    fireEvent.change(valueInput, { target: { value: '42' } });

    const objectUpdateCall = debugSpy.mock.calls.find(([message]) => message === 'Object value sample updated');
    expect(objectUpdateCall?.[1]).toMatchObject({ valueSampleKind: 'number' });
    expect(screen.getByLabelText('Value type')).toHaveValue('number');
    debugSpy.mockRestore();
  });

  it('shows key path input for get operation', () => {
    renderNode({ operation: 'get' });
    expect(screen.getByPlaceholderText('e.g. profile.address.city')).toBeInTheDocument();
  });
});
