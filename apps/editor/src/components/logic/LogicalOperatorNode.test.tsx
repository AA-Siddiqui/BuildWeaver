import { render, screen } from '@testing-library/react';
import { NodeProps, ReactFlowProvider } from 'reactflow';
import { LogicalOperatorNodeData } from '@buildweaver/libs';
import { LogicalOperatorNode } from './LogicalOperatorNode';
import { PreviewResolverProvider, createPreviewResolver } from './previewResolver';

const baseData: LogicalOperatorNodeData = {
  kind: 'logical',
  label: 'Logic',
  description: 'Testing',
  operation: 'and',
  primarySample: true,
  secondarySample: false
};

const renderNode = (data: LogicalOperatorNodeData) => {
  const resolver = createPreviewResolver([], []);
  const props = {
    id: 'logical-node',
    data,
    selected: false
  } as unknown as NodeProps<LogicalOperatorNodeData>;

  return render(
    <ReactFlowProvider>
      <PreviewResolverProvider resolver={resolver}>
        <LogicalOperatorNode {...props} />
      </PreviewResolverProvider>
    </ReactFlowProvider>
  );
};

describe('LogicalOperatorNode component', () => {
  it('renders two boolean inputs for AND/OR operations', () => {
    renderNode(baseData);
    expect(screen.getByText(/Input A/i)).toBeInTheDocument();
    expect(screen.getByText(/Input B/i)).toBeInTheDocument();
  });

  it('renders only one input when operation is NOT', () => {
    renderNode({ ...baseData, operation: 'not' });
    expect(screen.getByText(/Input A/i)).toBeInTheDocument();
    expect(screen.queryByText(/Input B/i)).toBeNull();
  });
});
