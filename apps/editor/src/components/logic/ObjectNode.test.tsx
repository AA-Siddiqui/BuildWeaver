import { fireEvent, render, screen } from '@testing-library/react';
import { NodeProps, ReactFlowProvider } from 'reactflow';
import { ObjectNodeData } from '@buildweaver/libs';
import { ObjectNode } from './ObjectNode';
import { PreviewResolverProvider, createPreviewResolver } from './previewResolver';

describe('ObjectNode component', () => {
  const baseData: ObjectNodeData = {
    kind: 'object',
    label: 'Object block',
    description: 'Test node',
    operation: 'merge',
    sourceSample: { status: 'idle', attempts: 0 },
    patchSample: { status: 'ready' }
  };

  const renderNode = (data: ObjectNodeData = baseData) => {
    const resolver = createPreviewResolver([], []);
    const props = {
      id: 'object-node',
      data,
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

  it('preserves trailing newlines in the source sample textarea', () => {
    renderNode();
    const [sourceTextarea] = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
    const nextValue = `${sourceTextarea.value}\n`;
    fireEvent.change(sourceTextarea, { target: { value: nextValue } });
    expect(sourceTextarea).toHaveValue(nextValue);
  });
});
