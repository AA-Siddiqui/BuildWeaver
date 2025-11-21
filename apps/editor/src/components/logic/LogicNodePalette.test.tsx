import { fireEvent, render, screen } from '@testing-library/react';
import { LogicNodePalette } from './LogicNodePalette';

describe('LogicNodePalette', () => {
  it('invokes callback when palette items are clicked', () => {
    const handleAdd = jest.fn();
    render(<LogicNodePalette onAddNode={handleAdd} />);

    fireEvent.click(screen.getByText('Page'));
    expect(handleAdd).toHaveBeenCalledWith('page');
  });
});
