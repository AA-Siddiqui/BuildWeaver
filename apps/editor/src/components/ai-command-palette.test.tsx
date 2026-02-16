import { render, screen, fireEvent } from '@testing-library/react';
import { AiCommandPalette } from './ai-command-palette';

describe('AiCommandPalette', () => {
  const defaultProps = {
    open: true,
    loading: false,
    onClose: jest.fn(),
    onSubmit: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when open is false', () => {
    render(<AiCommandPalette {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render the dialog when open is true', () => {
    render(<AiCommandPalette {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should render the AI label', () => {
    render(<AiCommandPalette {...defaultProps} />);
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('should render the input field', () => {
    render(<AiCommandPalette {...defaultProps} />);
    const input = screen.getByLabelText('AI prompt input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Describe the UI you want to build...');
  });

  it('should call onClose when Escape is pressed', () => {
    render(<AiCommandPalette {...defaultProps} />);
    const input = screen.getByLabelText('AI prompt input');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onSubmit with the prompt when Enter is pressed', () => {
    render(<AiCommandPalette {...defaultProps} />);
    const input = screen.getByLabelText('AI prompt input');
    fireEvent.change(input, { target: { value: 'Build a landing page' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onSubmit).toHaveBeenCalledWith('Build a landing page');
  });

  it('should not submit an empty prompt', () => {
    render(<AiCommandPalette {...defaultProps} />);
    const input = screen.getByLabelText('AI prompt input');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('should not submit a whitespace-only prompt', () => {
    render(<AiCommandPalette {...defaultProps} />);
    const input = screen.getByLabelText('AI prompt input');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('should not submit when loading', () => {
    render(<AiCommandPalette {...defaultProps} loading={true} />);
    const input = screen.getByLabelText('AI prompt input');
    fireEvent.change(input, { target: { value: 'Build a landing page' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('should show "Generating..." text when loading', () => {
    render(<AiCommandPalette {...defaultProps} loading={true} />);
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('should disable the input when loading', () => {
    render(<AiCommandPalette {...defaultProps} loading={true} />);
    const input = screen.getByLabelText('AI prompt input');
    expect(input).toBeDisabled();
  });

  it('should call onClose when backdrop is clicked', () => {
    render(<AiCommandPalette {...defaultProps} />);
    // The backdrop is the first div with bg-black/40 class
    const backdrop = screen.getByRole('dialog').querySelector('.bg-black\\/40');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose on backdrop click when loading', () => {
    render(<AiCommandPalette {...defaultProps} loading={true} />);
    const backdrop = screen.getByRole('dialog').querySelector('.bg-black\\/40');
    fireEvent.click(backdrop!);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('should trim the prompt before submitting', () => {
    render(<AiCommandPalette {...defaultProps} />);
    const input = screen.getByLabelText('AI prompt input');
    fireEvent.change(input, { target: { value: '  Build a page  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onSubmit).toHaveBeenCalledWith('Build a page');
  });

  it('should have maxLength of 2000 on the input', () => {
    render(<AiCommandPalette {...defaultProps} />);
    const input = screen.getByLabelText('AI prompt input');
    expect(input).toHaveAttribute('maxLength', '2000');
  });

  it('should show Enter keyboard hint when not loading', () => {
    render(<AiCommandPalette {...defaultProps} />);
    expect(screen.getByText('Enter')).toBeInTheDocument();
  });

  it('should not show Enter keyboard hint when loading', () => {
    render(<AiCommandPalette {...defaultProps} loading={true} />);
    expect(screen.queryByText('Enter')).not.toBeInTheDocument();
  });
});
