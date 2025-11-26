import { render, screen } from '@testing-library/react';
import { NodeProps, ReactFlowProvider } from 'reactflow';
import { RelationalOperatorNodeData } from '@buildweaver/libs';
import { RelationalOperatorNode } from './RelationalOperatorNode';
import { PreviewResolverProvider, createPreviewResolver } from './previewResolver';

const baseData: RelationalOperatorNodeData = {
  kind: 'relational',
  label: 'Relational',
  description: 'Testing',
  operation: 'gt',
  leftSample: 5,
  rightSample: 2,
  leftSampleKind: 'number',
  rightSampleKind: 'number'
};

const renderNode = (data: RelationalOperatorNodeData) => {
  const resolver = createPreviewResolver([], []);
  const props = {
    id: 'relational-node',
    data,
    selected: false
  } as unknown as NodeProps<RelationalOperatorNodeData>;

  return render(
    <ReactFlowProvider>
      <PreviewResolverProvider resolver={resolver}>
        <RelationalOperatorNode {...props} />
      </PreviewResolverProvider>
    </ReactFlowProvider>
  );
};

describe('RelationalOperatorNode component', () => {
  it('renders editors for both operands', () => {
    renderNode(baseData);
    expect(screen.getByText(/Left operand/i)).toBeInTheDocument();
    expect(screen.getByText(/Right operand/i)).toBeInTheDocument();
  });
});
