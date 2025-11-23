import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { LogicEditorNodeData } from '@buildweaver/libs';

export const useNodeDataUpdater = <TData extends LogicEditorNodeData>(nodeId: string) => {
  const { setNodes } = useReactFlow<LogicEditorNodeData>();

  return useCallback(
    (updater: (data: TData) => TData) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== nodeId) {
            return node;
          }
          return {
            ...node,
            data: updater(node.data as TData)
          };
        })
      );
    },
    [nodeId, setNodes]
  );
};
