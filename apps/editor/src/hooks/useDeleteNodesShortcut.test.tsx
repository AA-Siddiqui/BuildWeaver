import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import type { Node } from 'reactflow';
import type { LogicEditorNodeData } from '../types/api';
import { useDeleteNodesShortcut } from './useDeleteNodesShortcut';

const createNode = (id: string): Node<LogicEditorNodeData> => ({
  id,
  type: 'dummy',
  position: { x: 0, y: 0 },
  data: { kind: 'dummy', label: 'Dummy', sample: { type: 'integer', value: 1 } }
});

const TestHarness = (props: Parameters<typeof useDeleteNodesShortcut>[0]) => {
  useDeleteNodesShortcut(props);
  return null;
};

describe('useDeleteNodesShortcut', () => {
  it('invokes deleteElements when Delete is pressed', () => {
    const deleteElements = jest.fn();
    const onNodesDeleted = jest.fn();
    render(
      <TestHarness
        selectedNodeIds={['node-1']}
        nodes={[createNode('node-1')]}
        deleteElements={deleteElements}
        onNodesDeleted={onNodesDeleted}
      />
    );

    fireEvent.keyDown(window, { key: 'Delete' });

    expect(deleteElements).toHaveBeenCalledWith({ nodes: [expect.objectContaining({ id: 'node-1' })] });
    expect(onNodesDeleted).toHaveBeenCalledWith(['node-1']);
  });

  it('ignores key presses originating from form fields', () => {
    const deleteElements = jest.fn();
    render(
      <TestHarness selectedNodeIds={['node-1']} nodes={[createNode('node-1')]} deleteElements={deleteElements} />
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'Delete' });

    expect(deleteElements).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('supports Backspace when combined with modifier keys', () => {
    const deleteElements = jest.fn();
    render(
      <TestHarness selectedNodeIds={['node-1']} nodes={[createNode('node-1')]} deleteElements={deleteElements} />
    );

    fireEvent.keyDown(window, { key: 'Backspace', ctrlKey: true });

    expect(deleteElements).toHaveBeenCalledTimes(1);
  });
});
