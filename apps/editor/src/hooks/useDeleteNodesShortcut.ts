import { useCallback, useEffect } from 'react';
import type { Edge, Node } from 'reactflow';
import { logicLogger } from '../lib/logger';

type DeleteElementsFn<D = Record<string, unknown>> = (elements: { nodes?: Node<D>[]; edges?: Edge[] }) => void;

type Params<D = Record<string, unknown>> = {
  selectedNodeIds: string[];
  nodes: Node<D>[];
  deleteElements: DeleteElementsFn<D>;
  onNodesDeleted?: (nodeIds: string[]) => void;
  logger?: (message: string, meta?: Record<string, unknown>) => void;
};

const isFormElement = (target: EventTarget | null) =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target instanceof HTMLElement && target.isContentEditable;

export const useDeleteNodesShortcut = <D = Record<string, unknown>>({ selectedNodeIds, nodes, deleteElements, onNodesDeleted, logger }: Params<D>) => {
  const log = logger ?? logicLogger.warn.bind(logicLogger);

  const deleteSelection = useCallback(() => {
    if (selectedNodeIds.length === 0) {
      return;
    }
    const nodesToRemove = nodes.filter((node) => selectedNodeIds.includes(node.id));
    if (nodesToRemove.length === 0) {
      return;
    }
    log('Deleting nodes from selection', {
      count: nodesToRemove.length,
      nodeIds: nodesToRemove.map((node) => node.id)
    });
    deleteElements({ nodes: nodesToRemove });
    onNodesDeleted?.(nodesToRemove.map((node) => node.id));
  }, [deleteElements, log, nodes, onNodesDeleted, selectedNodeIds]);

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
