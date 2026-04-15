import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CodegenModal } from './CodegenModal';
import { useCodegen } from './useCodegen';

jest.mock('./useCodegen', () => ({
  useCodegen: jest.fn(),
}));

const mockedUseCodegen = useCodegen as jest.MockedFunction<typeof useCodegen>;

type HookResult = ReturnType<typeof useCodegen>;

const createHookResult = (overrides: Partial<HookResult> = {}): HookResult => ({
  status: 'idle',
  error: null,
  progress: '',
  availability: null,
  deployment: null,
  generate: jest.fn(),
  checkAvailability: jest.fn(),
  deploy: jest.fn(),
  reset: jest.fn(),
  ...overrides,
});

describe('CodegenModal', () => {
  it('renders deploy controls and triggers availability/deploy actions', () => {
    const hookResult = createHookResult();
    mockedUseCodegen.mockReturnValue(hookResult);

    render(
      <CodegenModal
        projectId="project-1"
        projectName="My Preview App"
        onClose={jest.fn()}
      />,
    );

    const deploymentInput = screen.getByLabelText('Preferred subdomain');
    fireEvent.change(deploymentInput, { target: { value: 'my-slot' } });

    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(hookResult.checkAvailability).toHaveBeenCalledWith('my-slot');

    fireEvent.click(screen.getByRole('button', { name: 'Deploy to Preview' }));
    expect(hookResult.deploy).toHaveBeenCalledWith('my-slot', 'react-web');

    const reactButton = screen.getByText('Generate React').closest('button');
    expect(reactButton).not.toBeNull();
    fireEvent.click(reactButton as HTMLButtonElement);
    expect(hookResult.generate).toHaveBeenCalledWith('react-web');

    const flutterButton = screen.getByText('Generate Flutter').closest('button');
    expect(flutterButton).not.toBeNull();
    fireEvent.click(flutterButton as HTMLButtonElement);
    expect(hookResult.generate).toHaveBeenCalledWith('flutter');
  });

  it('shows availability details for the currently entered name', () => {
    const hookResult = createHookResult({
      availability: {
        available: true,
        normalizedName: 'my-preview-app',
        frontendDomain: 'my-preview-app.preview.buildweaver.dev',
        backendDomain: 'api.my-preview-app.preview.buildweaver.dev',
      },
    });
    mockedUseCodegen.mockReturnValue(hookResult);

    render(
      <CodegenModal
        projectId="project-1"
        projectName="My Preview App"
        onClose={jest.fn()}
      />,
    );

    expect(
      screen.getByText(
        /Available\. Frontend: my-preview-app\.preview\.buildweaver\.dev \| Backend: api\.my-preview-app\.preview\.buildweaver\.dev/i,
      ),
    ).toBeInTheDocument();
  });

  it('shows deployed URLs in the completion state', () => {
    const hookResult = createHookResult({
      status: 'complete',
      deployment: {
        deploymentId: 'dep-1',
        deploymentName: 'my-preview-app',
        status: 'deployed',
        frontendDomain: 'my-preview-app.preview.buildweaver.dev',
        backendDomain: 'api.my-preview-app.preview.buildweaver.dev',
        frontendUrl: 'https://my-preview-app.preview.buildweaver.dev',
        backendUrl: 'https://api.my-preview-app.preview.buildweaver.dev',
        remotePath: '/opt/buildweaver-preview/my-preview-app',
      },
    });
    mockedUseCodegen.mockReturnValue(hookResult);

    render(
      <CodegenModal
        projectId="project-1"
        projectName="My Preview App"
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Deployment completed!')).toBeInTheDocument();
    expect(
      screen.getByText('Frontend URL: https://my-preview-app.preview.buildweaver.dev'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Backend URL: https://api.my-preview-app.preview.buildweaver.dev'),
    ).toBeInTheDocument();
  });
});
