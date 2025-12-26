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

  it('invokes callback specifically for page additions', () => {
    const handleAdd = jest.fn();
    render(<LogicNodePalette onAddNode={handleAdd} />);

    fireEvent.click(screen.getByText('Page'));

    expect(handleAdd).toHaveBeenCalledWith('page');
  });

  it('renders user functions section with actions', () => {
    const handleAddFunctionNode = jest.fn();
    const handleCreateFunction = jest.fn();
    const handleEditFunction = jest.fn();
    const handleDeleteFunction = jest.fn();
    render(
      <LogicNodePalette
        onAddNode={jest.fn()}
        userFunctions={[{ id: 'fn-1', name: 'Formatter', returnsValue: true }]}
        onCreateFunction={handleCreateFunction}
        onEditFunction={handleEditFunction}
        onDeleteFunction={handleDeleteFunction}
        onAddFunctionNode={handleAddFunctionNode}
      />
    );

    fireEvent.click(screen.getByText('New'));
    expect(handleCreateFunction).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Formatter'));
    expect(handleAddFunctionNode).toHaveBeenCalledWith('fn-1');

    fireEvent.click(screen.getByText('Edit'));
    expect(handleEditFunction).toHaveBeenCalledWith('fn-1');

    fireEvent.click(screen.getByText('Delete'));
    expect(handleDeleteFunction).toHaveBeenCalledWith('fn-1');
  });

  it('renders page route list with provided routes', () => {
    render(<LogicNodePalette onAddNode={jest.fn()} pageRoutes={['landing', 'about/team']} />);

    expect(screen.getByText('/landing')).toBeInTheDocument();
    expect(screen.getByText('/about/team')).toBeInTheDocument();
  });

  it('renders page route error state when provided', () => {
    render(
      <LogicNodePalette
        onAddNode={jest.fn()}
        pageRoutesError="Unable to load routes"
      />
    );

    expect(screen.getByTestId('page-routes-error')).toHaveTextContent('Unable to load routes');
  });
});
