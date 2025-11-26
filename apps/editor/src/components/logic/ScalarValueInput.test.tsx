import { fireEvent, render, screen } from '@testing-library/react';
import { ScalarValueInput } from './ScalarValueInput';

describe('ScalarValueInput', () => {
  const baseProps = {
    nodeId: 'node-1',
    fieldKey: 'conditional.truthy',
    onValueKindChange: jest.fn(),
    onValueChange: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invokes the combined kind/value handler when provided', () => {
    const onKindCommit = jest.fn();
    render(
      <ScalarValueInput
        {...baseProps}
        valueKind="string"
        value="Alpha"
        onValueKindCommit={onKindCommit}
      />
    );

    fireEvent.change(screen.getByLabelText(/Value type/i), { target: { value: 'number' } });

    expect(onKindCommit).toHaveBeenCalledWith({ kind: 'number', value: 0 });
    expect(baseProps.onValueKindChange).not.toHaveBeenCalled();
    expect(baseProps.onValueChange).not.toHaveBeenCalled();
  });

  it('preserves numeric draft text while parsing values', () => {
    const onValueChange = jest.fn();
    render(
      <ScalarValueInput
        {...baseProps}
        valueKind="number"
        value={12}
        onValueChange={onValueChange}
      />
    );

    const input = screen.getByLabelText(/Numeric value/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1.' } });

    expect(input.value).toBe('1.');
    expect(onValueChange).toHaveBeenLastCalledWith(1);
  });
});
