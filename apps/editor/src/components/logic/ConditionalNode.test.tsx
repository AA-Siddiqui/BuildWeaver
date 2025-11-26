import { render, screen } from '@testing-library/react';
import { NodeProps, ReactFlowProvider } from 'reactflow';
import { ConditionalNodeData } from '@buildweaver/libs';
import { ConditionalNode } from './ConditionalNode';
import { PreviewResolverProvider, createPreviewResolver } from './previewResolver';

const baseData: ConditionalNodeData = {
  kind: 'conditional',
  label: 'Conditional',
  description: 'Testing node',
  conditionSample: true,
  trueValue: 'Alpha',
  falseValue: 'Beta',
  trueValueKind: 'string',
  falseValueKind: 'string'
};

const renderNode = (data: ConditionalNodeData) => {
  const resolver = createPreviewResolver([], []);
  const props = {
    id: 'conditional-node',
    data,
    selected: false
  } as unknown as NodeProps<ConditionalNodeData>;

  return render(
    <ReactFlowProvider>
      <PreviewResolverProvider resolver={resolver}>
        <ConditionalNode {...props} />
      </PreviewResolverProvider>
    </ReactFlowProvider>
  );
};

describe('ConditionalNode component', () => {
  it('renders condition, truthy, and falsy inputs', () => {
    renderNode(baseData);
    expect(screen.getAllByText(/Condition/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/Value if true/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/Value if false/i)).not.toHaveLength(0);
  });

  it('shows a select control for the condition sample when unbound', () => {
    renderNode(baseData);
    expect(screen.getByLabelText(/Condition sample/i)).toBeInTheDocument();
  });
});
