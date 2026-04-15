import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectCheckpointModal } from './ProjectCheckpointModal';
import { projectCheckpointsApi } from '../../lib/api-client';

jest.mock('../../lib/api-client', () => ({
  projectCheckpointsApi: {
    list: jest.fn(),
    create: jest.fn(),
    restore: jest.fn()
  }
}));

jest.mock('../../lib/logger', () => ({
  checkpointLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const mockedCheckpointsApi = projectCheckpointsApi as jest.Mocked<typeof projectCheckpointsApi>;

const renderModal = (overrides?: Partial<React.ComponentProps<typeof ProjectCheckpointModal>>) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  const props: React.ComponentProps<typeof ProjectCheckpointModal> = {
    projectId: 'project-1',
    isOpen: true,
    onClose: jest.fn(),
    ...overrides
  };

  render(
    <QueryClientProvider client={queryClient}>
      <ProjectCheckpointModal {...props} />
    </QueryClientProvider>
  );

  return props;
};

describe('ProjectCheckpointModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCheckpointsApi.list.mockResolvedValue({ checkpoints: [] });
  });

  it('creates a new checkpoint from the create flow', async () => {
    const onBeforeCreate = jest.fn().mockResolvedValue(undefined);
    mockedCheckpointsApi.create.mockResolvedValue({
      checkpoint: {
        id: 'checkpoint-1',
        projectId: 'project-1',
        name: 'Milestone A',
        description: 'After node cleanup',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        capturedAt: new Date().toISOString(),
        counts: {
          pages: 2,
          components: 1,
          deployments: 0,
          graphNodes: 6,
          graphEdges: 4,
          functions: 1,
          databases: 0,
          queries: 0
        }
      }
    });

    renderModal({ onBeforeCreate });

    fireEvent.click(screen.getByRole('button', { name: /make new checkpoint/i }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Milestone A' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'After node cleanup' } });
    fireEvent.click(screen.getByRole('button', { name: /save checkpoint/i }));

    await waitFor(() => {
      expect(onBeforeCreate).toHaveBeenCalledTimes(1);
    });
    expect(mockedCheckpointsApi.create).toHaveBeenCalledWith('project-1', {
      name: 'Milestone A',
      description: 'After node cleanup'
    });
    expect(await screen.findByText(/created checkpoint/i)).toBeInTheDocument();
  });

  it('restores an old checkpoint from the restore flow', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const onRestored = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();

    mockedCheckpointsApi.list.mockResolvedValue({
      checkpoints: [
        {
          id: 'checkpoint-1',
          projectId: 'project-1',
          name: 'Before refactor',
          description: 'stable baseline',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          capturedAt: new Date().toISOString(),
          counts: {
            pages: 3,
            components: 2,
            deployments: 0,
            graphNodes: 12,
            graphEdges: 10,
            functions: 2,
            databases: 1,
            queries: 2
          }
        }
      ]
    });

    mockedCheckpointsApi.restore.mockResolvedValue({
      checkpoint: {
        id: 'checkpoint-1',
        projectId: 'project-1',
        name: 'Before refactor',
        description: 'stable baseline',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        capturedAt: new Date().toISOString(),
        counts: {
          pages: 3,
          components: 2,
          deployments: 0,
          graphNodes: 12,
          graphEdges: 10,
          functions: 2,
          databases: 1,
          queries: 2
        }
      }
    });

    renderModal({ onRestored, onClose });

    fireEvent.click(screen.getByRole('button', { name: /restart from old checkpoint/i }));
    await screen.findByText('Before refactor');
    fireEvent.click(screen.getByRole('button', { name: /^restart$/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledTimes(1);
    });
    expect(mockedCheckpointsApi.restore).toHaveBeenCalledWith('project-1', 'checkpoint-1');
    await waitFor(() => {
      expect(onRestored).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    confirmSpy.mockRestore();
  });
});
