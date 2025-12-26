import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NodeProps } from 'reactflow';
import type { PageNodeData, PageDocument } from '@buildweaver/libs';
import { PageNode } from './PageNode';
import { PageRouteRegistryProvider, PageRouteRegistryValue } from './PageRouteRegistryContext';
import { projectPagesApi } from '../../lib/api-client';

jest.mock('../../lib/api-client', () => ({
  projectPagesApi: {
    update: jest.fn()
  }
}));

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ projectId: 'project-123' })
}));

const mockSetNodes = jest.fn();

jest.mock('reactflow', () => ({
  Handle: ({ children }: { children?: ReactNode }) => <div data-testid="handle">{children}</div>,
  Position: { Left: 'left', Right: 'right' },
  useReactFlow: () => ({ setNodes: mockSetNodes })
}));

describe('PageNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderPageNode = (overrides?: Partial<PageNodeData>, registryOverrides?: Partial<PageRouteRegistryValue>) => {
    const baseData: PageNodeData = {
      kind: 'page',
      pageId: 'page-1',
      pageName: 'Landing',
      routeSegment: 'landing',
      inputs: []
    };

    const props = {
      data: { ...baseData, ...overrides },
      selected: false
    } as unknown as NodeProps<PageNodeData>;

    const queryClient = new QueryClient();
    const registryValue: PageRouteRegistryValue = {
      routes: registryOverrides?.routes ?? [],
      isRouteAvailable: registryOverrides?.isRouteAvailable ?? (() => true)
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <PageRouteRegistryProvider value={registryValue}>
          <PageNode {...props} />
        </PageRouteRegistryProvider>
      </QueryClientProvider>
    );
  };

  it('updates metadata via edit modal', async () => {
    const page: PageDocument = {
      id: 'page-1',
      projectId: 'project-123',
      name: 'Docs',
      slug: 'docs',
      builderState: {},
      dynamicInputs: [],
      createdAt: 'now',
      updatedAt: 'now'
    };
    (projectPagesApi.update as jest.Mock).mockResolvedValue({ page });

    renderPageNode();

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Docs' } });
    fireEvent.change(screen.getByLabelText(/Route/i), { target: { value: 'docs' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));

    await waitFor(() => expect(projectPagesApi.update).toHaveBeenCalledWith('project-123', 'page-1', { name: 'Docs', slug: 'docs' }));

    expect(await screen.findByText('Docs')).toBeInTheDocument();
    expect(await screen.findByText('/docs')).toBeInTheDocument();
  });

  it('prevents editing to a duplicate route', async () => {
    const registrySpy = jest.fn((route: string) => route !== 'docs');
    renderPageNode(undefined, { routes: ['docs'], isRouteAvailable: registrySpy });

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Docs' } });
    fireEvent.change(screen.getByLabelText(/Route/i), { target: { value: 'docs' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));

    expect(projectPagesApi.update).not.toHaveBeenCalled();
    expect(await screen.findByText('Route /docs already exists')).toBeInTheDocument();
  });
});
