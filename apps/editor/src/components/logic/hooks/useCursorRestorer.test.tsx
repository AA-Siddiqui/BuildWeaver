import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useCursorRestorer } from './useCursorRestorer';

describe('useCursorRestorer', () => {
  const TestInput = () => {
    const [value, setValue] = useState('world');
    const restoreCursor = useCursorRestorer();

    return (
      <input
        data-testid="cursor-input"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          restoreCursor(event.target, { nodeId: 'test-node', field: 'sample' });
        }}
      />
    );
  };

  it('restores the caret position after controlled updates', async () => {
    render(<TestInput />);
    const input = screen.getByTestId('cursor-input') as HTMLInputElement;

    input.setSelectionRange(0, 0);
    fireEvent.change(input, { target: { value: 'Zworld', selectionStart: 1, selectionEnd: 1 } });

    await waitFor(() => {
      expect(input.selectionStart).toBe(1);
      expect(input.selectionEnd).toBe(1);
    });
  });
});
