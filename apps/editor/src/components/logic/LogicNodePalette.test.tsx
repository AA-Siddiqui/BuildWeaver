import { fireEvent, render, screen } from '@testing-library/react';
import { LogicNodePalette } from './LogicNodePalette';

describe('LogicNodePalette', () => {
  it('invokes callback when palette items are clicked', () => {
    const handleAdd = jest.fn();
    render(<LogicNodePalette onAddNode={handleAdd} />);

    const buttons = ['Page', 'Dummy', 'Arithmetic', 'String', 'List', 'Object'];
    buttons.forEach((label) => {
      fireEvent.click(screen.getByText(label));
    });

    expect(handleAdd).toHaveBeenCalledTimes(buttons.length);
    expect(handleAdd).toHaveBeenCalledWith('object');
  });
});
