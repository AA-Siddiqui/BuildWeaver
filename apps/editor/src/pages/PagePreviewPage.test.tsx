import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Data } from '@measured/puck';
import { PagePreviewPage } from './PagePreviewPage';
import { projectPagesApi } from '../lib/api-client';

jest.mock('@measured/puck', () => ({
  Render: ({ data }: { data: Data }) => (
    <div data-testid="preview-render">{JSON.stringify(data.content ?? [])}</div>
  )
}));

jest.mock('../lib/api-client', () => ({
  projectPagesApi: {
    get: jest.fn()
  },
  projectGraphApi: {
    get: jest.fn().mockResolvedValue({ graph: undefined })
  }
}));

const renderWithProviders = (ui: ReactNode, initialEntries: string[]) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      }
    }
  });

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/app/:projectId/page/:pageId/preview" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { queryClient, rendered };
};

const builderState: Data = ({
  root: { id: 'root', props: {}, children: [] },
  content: [
    {
      type: 'Section',
      props: { id: 'section-1', minHeight: '100vh' }
    }
  ]
} as unknown) as Data;

const seedSnapshot = (token: string, inputs: [] = []) => {
  window.localStorage.setItem(
    `bw-preview:${token}`,
    JSON.stringify({ state: builderState, inputs, createdAt: Date.now() })
  );
  return token;
};

describe('PagePreviewPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it('renders from snapshot payload when token is present', async () => {
    const token = seedSnapshot('preview-token');

    renderWithProviders(<PagePreviewPage />, [`/app/proj-1/page/page-1/preview?token=${token}`]);

    await waitFor(() => expect(screen.getByTestId('preview-render')).toBeInTheDocument());
    expect(screen.getByTestId('preview-render').textContent).toContain('section-1');
    expect(projectPagesApi.get).not.toHaveBeenCalled();
  });

  it('falls back to server data when snapshot is missing', async () => {
    (projectPagesApi.get as jest.Mock).mockResolvedValueOnce({
      page: {
        id: 'page-1',
        name: 'Hero',
        builderState,
        dynamicInputs: [],
        updatedAt: new Date().toISOString()
      }
    });

    renderWithProviders(<PagePreviewPage />, ['/app/proj-1/page/page-1/preview']);

    await waitFor(() => expect(screen.getByTestId('preview-render')).toBeInTheDocument());
    expect(projectPagesApi.get).toHaveBeenCalledWith('proj-1', 'page-1');
  });

  it('switches viewport modes via floating controls', async () => {
    const token = seedSnapshot('viewport-token');
    renderWithProviders(<PagePreviewPage />, [`/app/proj-2/page/page-1/preview?token=${token}`]);

    const canvas = await screen.findByTestId('preview-canvas');
    const initialWidth = canvas.style.width;

    fireEvent.click(screen.getByTestId('viewport-button-mobile'));

    await waitFor(() => expect(canvas.style.width).not.toEqual(initialWidth));
    expect(canvas.style.width).toBe('390px');
  });

  it('auto hides controls and reveals them when hovering near the edge', async () => {
    jest.useFakeTimers();
    try {
      const token = seedSnapshot('auto-hide-token');
      renderWithProviders(<PagePreviewPage />, [`/app/proj-3/page/page-1/preview?token=${token}`]);

      const controls = await screen.findByTestId('viewport-controls');
      expect(controls.dataset.visible).toBe('true');

      jest.advanceTimersByTime(3500);
      await waitFor(() => expect(controls.dataset.visible).toBe('false'));

      fireEvent.mouseEnter(screen.getByTestId('viewport-hot-zone'));
      await waitFor(() => expect(controls.dataset.visible).toBe('true'));
    } finally {
      jest.useRealTimers();
    }
  });
});
