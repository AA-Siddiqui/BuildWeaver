import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { Config, Data } from '@measured/puck';
import { BuilderPreviewModal, PREVIEW_VIEWPORTS, type BuilderPreviewViewport } from './builder-preview-modal';

jest.mock('@measured/puck', () => ({
  Render: ({ data }: { data: Data }) => (
    <div data-testid="mock-render">{(data?.content?.length ?? 0).toString()}</div>
  )
}));

describe('BuilderPreviewModal', () => {
  const baseConfig = { components: {} } as unknown as Config;
  const baseData = {
    root: { id: 'root', props: {}, children: [] },
    content: []
  } as Data;

  const renderModal = (props?: Partial<ComponentProps<typeof BuilderPreviewModal>>) => {
    const defaultProps: ComponentProps<typeof BuilderPreviewModal> = {
      isOpen: true,
      mode: 'desktop',
      onModeChange: jest.fn(),
      onClose: jest.fn(),
      config: baseConfig,
      data: baseData,
      pageName: 'Test Page'
    };

    return render(<BuilderPreviewModal {...defaultProps} {...props} />);
  };

  it('does not render when modal is closed', () => {
    const { container } = render(
      <BuilderPreviewModal
        isOpen={false}
        mode="desktop"
        onModeChange={jest.fn()}
        onClose={jest.fn()}
        config={baseConfig}
        data={baseData}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders page information and preview content when open', () => {
    renderModal({ pageName: 'Marketing Page' });
    expect(screen.getByText('Previewing')).toBeInTheDocument();
    expect(screen.getByText('Marketing Page')).toBeInTheDocument();
    expect(screen.getByTestId('mock-render')).toHaveTextContent('0');
  });

  it('invokes mode change handler when a different viewport is selected', () => {
    const onModeChange = jest.fn();
    renderModal({ mode: 'desktop', onModeChange });
    const targetMode: BuilderPreviewViewport = 'tablet';
    fireEvent.click(screen.getByText(PREVIEW_VIEWPORTS[targetMode].label));
    expect(onModeChange).toHaveBeenCalledWith(targetMode);
  });

  it('invokes close handler when the close button is pressed', () => {
    const onClose = jest.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
