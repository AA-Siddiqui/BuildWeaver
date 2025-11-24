import { render, screen } from '@testing-library/react';
import { NodeProps, ReactFlowProvider } from 'reactflow';
import { ArithmeticNode } from './ArithmeticNode';
import { ArithmeticNodeData } from '@buildweaver/libs';
import { PreviewResolverProvider, createPreviewResolver } from './previewResolver';

describe('ArithmeticNode component', () => {
  const baseData: ArithmeticNodeData = {
    kind: 'arithmetic',
    label: 'Math block',
    description: 'Test',
    operation: 'modulo',
    precision: 2,
    operands: [
      { id: 'a', label: 'Dividend', sampleValue: 10 },
      { id: 'b', label: 'Divisor', sampleValue: 3 }
    ]
  };

  const renderNode = (data: ArithmeticNodeData) => {
    const resolver = createPreviewResolver([], []);
    const props = {
      id: 'node-1',
      data,
      selected: false
    } as unknown as NodeProps<ArithmeticNodeData>;
    return render(
      <ReactFlowProvider>
        <PreviewResolverProvider resolver={resolver}>
          <ArithmeticNode {...props} />
        </PreviewResolverProvider>
      </ReactFlowProvider>
    );
  };

  it('renders two inputs for modulo and prevents extra rendering', () => {
    renderNode({
      ...baseData,
      operands: [
        ...baseData.operands,
        { id: 'c', label: 'Extra', sampleValue: 1 }
      ]
    });

    expect(screen.getByText('Dividend')).toBeInTheDocument();
    expect(screen.getByText('Divisor')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add operand/i })).not.toBeInTheDocument();
  });
});
