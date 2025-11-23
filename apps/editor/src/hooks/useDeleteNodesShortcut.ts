import { useCallback, useEffect } from 'react';
import type { Edge, Node } from 'reactflow';
import type { LogicEditorNodeData } from '../types/api';
import { logicLogger } from '../lib/logger';

type DeleteElementsFn = (elements: { nodes?: Node<LogicEditorNodeData>[]; edges?: Edge[] }) => void;

type Params = {
  selectedNodeIds: string[];
  nodes: Node<LogicEditorNodeData>[];
  deleteElements: DeleteElementsFn;
  onNodesDeleted?: (nodeIds: string[]) => void;
};

const isFormElement = (target: EventTarget | null) =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target instanceof HTMLElement && target.isContentEditable;

export const useDeleteNodesShortcut = ({ selectedNodeIds, nodes, deleteElements, onNodesDeleted }: Params) => {
  const deleteSelection = useCallback(() => {
    if (selectedNodeIds.length === 0) {
      return;
    }
    const nodesToRemove = nodes.filter((node) => selectedNodeIds.includes(node.id));
    if (nodesToRemove.length === 0) {
      return;
    }
    logicLogger.warn('Deleting nodes from selection', {
      count: nodesToRemove.length,
      nodeIds: nodesToRemove.map((node) => node.id)
    });
    deleteElements({ nodes: nodesToRemove });
    onNodesDeleted?.(nodesToRemove.map((node) => node.id));
  }, [deleteElements, nodes, onNodesDeleted, selectedNodeIds]);

  useEffect(() => {
    if (!selectedNodeIds.length) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isFormElement(event.target)) {
        return;
      }
      if (event.key === 'Delete' || (event.key === 'Backspace' && (event.metaKey || event.ctrlKey))) {
        event.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelection, selectedNodeIds.length]);

  return deleteSelection;
};
