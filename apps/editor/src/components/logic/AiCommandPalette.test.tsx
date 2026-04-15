import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AiCommandPalette } from './AiCommandPalette';

describe('AiCommandPalette', () => {
  const defaultProps = {
    isOpen: true,
    isLoading: false,
    onSubmit: jest.fn(),
    onClose: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(<AiCommandPalette {...defaultProps} />);
    expect(screen.getByTestId('ai-command-input')).toBeInTheDocument();
    expect(screen.getByTestId('ai-command-submit')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<AiCommandPalette {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('ai-command-input')).not.toBeInTheDocument();
  });

  it('calls onSubmit with trimmed prompt when form is submitted', () => {
    render(<AiCommandPalette {...defaultProps} />);
    const input = screen.getByTestId('ai-command-input');
    fireEvent.change(input, { target: { value: '  add two numbers  ' } });
    fireEvent.submit(input.closest('form')!);
    expect(defaultProps.onSubmit).toHaveBeenCalledWith('add two numbers', {
      agentMode: true
    });
  });

  it('shows error when submitting empty prompt', () => {
    render(<AiCommandPalette {...defaultProps} />);
    fireEvent.submit(screen.getByTestId('ai-command-input').closest('form')!);
    expect(screen.getByTestId('ai-command-error')).toBeInTheDocument();
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('shows error when prompt is too short', () => {
    render(<AiCommandPalette {...defaultProps} />);
    const input = screen.getByTestId('ai-command-input');
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByTestId('ai-command-error')).toBeInTheDocument();
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    render(<AiCommandPalette {...defaultProps} />);
    fireEvent.keyDown(screen.getByTestId('ai-command-input'), { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    render(<AiCommandPalette {...defaultProps} />);
    fireEvent.click(screen.getByTestId('ai-command-palette-backdrop'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not close on backdrop click while loading', () => {
    render(<AiCommandPalette {...defaultProps} isLoading={true} />);
    fireEvent.click(screen.getByTestId('ai-command-palette-backdrop'));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<AiCommandPalette {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Generating...')).toBeInTheDocument();
    expect(screen.getByText(/AI is generating/)).toBeInTheDocument();
  });

  it('disables input and submit while loading', () => {
    render(<AiCommandPalette {...defaultProps} isLoading={true} />);
    expect(screen.getByTestId('ai-command-input')).toBeDisabled();
    expect(screen.getByTestId('ai-command-submit')).toBeDisabled();
  });

  it('disables submit when input is empty', () => {
    render(<AiCommandPalette {...defaultProps} />);
    expect(screen.getByTestId('ai-command-submit')).toBeDisabled();
  });

  it('enables submit when input has text', () => {
    render(<AiCommandPalette {...defaultProps} />);
    fireEvent.change(screen.getByTestId('ai-command-input'), { target: { value: 'some logic' } });
    expect(screen.getByTestId('ai-command-submit')).not.toBeDisabled();
  });

  it('clears error when text changes', async () => {
    render(<AiCommandPalette {...defaultProps} />);
    // Trigger error
    fireEvent.submit(screen.getByTestId('ai-command-input').closest('form')!);
    expect(screen.getByTestId('ai-command-error')).toBeInTheDocument();

    // Type something — error should clear
    fireEvent.change(screen.getByTestId('ai-command-input'), { target: { value: 'valid' } });
    await waitFor(() => {
      expect(screen.queryByTestId('ai-command-error')).not.toBeInTheDocument();
    });
  });

  it('shows header text', () => {
    render(<AiCommandPalette {...defaultProps} />);
    expect(screen.getByText('AI Builder')).toBeInTheDocument();
  });

  it('clears prompt when reopened', () => {
    const { rerender } = render(<AiCommandPalette {...defaultProps} isOpen={false} />);
    // Set state then reopen
    rerender(<AiCommandPalette {...defaultProps} isOpen={true} />);
    expect(screen.getByTestId('ai-command-input')).toHaveValue('');
  });

  it('submits with agent mode disabled when unchecked', () => {
    render(<AiCommandPalette {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Enable agent mode'));
    fireEvent.change(screen.getByTestId('ai-command-input'), { target: { value: 'build rules' } });
    fireEvent.submit(screen.getByTestId('ai-command-input').closest('form')!);

    expect(defaultProps.onSubmit).toHaveBeenCalledWith('build rules', {
      agentMode: false
    });
  });

  it('uses the generic input placeholder', () => {
    render(<AiCommandPalette {...defaultProps} />);
    expect(screen.getByTestId('ai-command-input')).toHaveAttribute(
      'placeholder',
      'Describe what you want to build or change...'
    );
  });
});
