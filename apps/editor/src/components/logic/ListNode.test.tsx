import { render, screen } from '@testing-library/react';
import { NodeProps, ReactFlowProvider } from 'reactflow';
import { ListNode } from './ListNode';
import { ListNodeData } from '@buildweaver/libs';
import { PreviewResolverProvider, createPreviewResolver } from './previewResolver';

describe('ListNode component', () => {
  const baseData: ListNodeData = {
    kind: 'list',
    label: 'List block',
    description: 'Test node',
    operation: 'slice',
    primarySample: [1, 2, 3],
    secondarySample: [4, 5],
    startSample: 0,
    endSample: 2,
    sort: 'asc'
  };

  const renderNode = (data: ListNodeData) => {
    const resolver = createPreviewResolver([], []);
    const props = {
      id: 'list-node',
      data,
      selected: false
    } as unknown as NodeProps<ListNodeData>;
    return render(
      <ReactFlowProvider>
        <PreviewResolverProvider resolver={resolver}>
          <ListNode {...props} />
        </PreviewResolverProvider>
      </ReactFlowProvider>
    );
  };

  it('renders three inputs for slice operation', () => {
    renderNode(baseData);
    expect(screen.getByText(/List input/i)).toBeInTheDocument();
    expect(screen.getByText(/Start index/i)).toBeInTheDocument();
    expect(screen.getByText(/End index/i)).toBeInTheDocument();
  });

  it('renders only one input for unique', () => {
    renderNode({ ...baseData, operation: 'unique' });
    const label = screen.getByText(/List input/i);
    expect(label).toBeInTheDocument();
    expect(screen.queryByText(/Start index/i)).toBeNull();
    expect(screen.queryByText(/Additional input/i)).toBeNull();
  });

  it('does not render a preview limit input anymore', () => {
    renderNode(baseData);
    expect(screen.queryByText(/Preview limit/i)).toBeNull();
  });
});
