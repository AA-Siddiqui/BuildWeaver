import { useEffect } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import type { FunctionNodeData } from '@buildweaver/libs';
import { NodeChrome } from '../NodeChrome';
import { useNodeDataUpdater } from '../hooks/useNodeDataUpdater';
import { useFunctionRegistry } from './FunctionRegistryContext';
import { logicLogger } from '../../../lib/logger';
import { usePreviewResolver } from '../previewResolver';

const getHandleOffset = (index: number, total: number) => {
  if (total <= 0) {
    return '50%';
  }
  const percent = ((index + 1) / (total + 1)) * 100;
  return `${percent}%`;
};

export const FunctionNode = ({ id, data }: NodeProps<FunctionNodeData>) => {
  const updateData = useNodeDataUpdater<FunctionNodeData>(id);
  const { getFunctionById } = useFunctionRegistry();
  const definition = getFunctionById(data.functionId);
  const argumentHandles = definition?.arguments ?? [];
  const returnsValue = definition?.returnsValue ?? data.returnsValue ?? false;
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);

  useEffect(() => {
    if (definition && definition.name !== data.functionName) {
      updateData((prev) => ({ ...prev, functionName: definition.name }));
    }
  }, [data.functionName, definition, updateData]);

  useEffect(() => {
    if (typeof definition?.returnsValue === 'boolean' && definition.returnsValue !== data.returnsValue) {
      logicLogger.debug('Synced function node return metadata', {
        nodeId: id,
        functionId: data.functionId,
        returnsValue: definition.returnsValue
      });
      updateData((prev) => ({ ...prev, returnsValue: definition.returnsValue }));
    }
  }, [data.functionId, data.returnsValue, definition?.returnsValue, id, updateData]);

  const handleToggleMode = () => {
    const nextMode = data.mode === 'applied' ? 'reference' : 'applied';
    logicLogger.info('Function node mode toggled', {
      nodeId: id,
      functionId: data.functionId,
      mode: nextMode
    });
    updateData((prev) => ({ ...prev, mode: nextMode }));
  };

  const label = definition?.name ?? data.functionName ?? 'Unknown function';
  const badge = definition ? 'Function' : 'Function (missing)';

  return (
    <div className="relative">
      <NodeChrome badge={badge} label={label} description={definition?.description ?? 'Reusable logic block'} preview={preview}>
        {!definition && (
          <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            Function deleted or unavailable.
          </p>
        )}
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
          <span className="uppercase tracking-[0.2em] text-bw-platinum/70">Mode</span>
          <button
            type="button"
            onClick={handleToggleMode}
            className="rounded-lg bg-bw-sand px-3 py-1 text-[11px] font-semibold text-bw-ink"
          >
            {data.mode === 'applied' ? 'Applied' : 'Reference'}
          </button>
        </div>
        {definition && definition.arguments.length === 0 && (
          <p className="mt-2 rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-2 text-xs text-bw-platinum/70">
            No arguments configured for this function.
          </p>
        )}
        {definition && definition.arguments.length > 0 && (
          <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white">
            <p className="text-[10px] uppercase tracking-[0.2em] text-bw-platinum/60">Arguments</p>
            <ul className="mt-1 space-y-1">
              {definition.arguments.map((argument) => (
                <li key={argument.id} className="flex justify-between text-[11px]">
                  <span>{argument.name}</span>
                  <span className="text-bw-platinum/70">{argument.type}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </NodeChrome>
      {data.mode === 'applied' &&
        argumentHandles.map((argument, index) => (
          <Handle
            key={argument.id}
            type="target"
            position={Position.Left}
            id={`arg-${argument.id}`}
            className="pointer-events-auto !left-[-6px] !h-3 !w-3 !bg-bw-platinum"
            style={{ top: getHandleOffset(index, argumentHandles.length) }}
          />
        ))}
      {data.mode === 'applied' && definition && argumentHandles.length === 0 && (
        <span className="absolute left-[-64px] top-1/2 -translate-y-1/2 rotate-90 text-[10px] uppercase tracking-[0.3em] text-bw-platinum/40">
          No inputs
        </span>
      )}
      {data.mode === 'reference' && (
        <Handle
          type="source"
          position={Position.Right}
          id="function-reference"
          className="pointer-events-auto !right-[-6px] !h-3 !w-3 !bg-bw-platinum"
          style={{ top: '50%' }}
        />
      )}
      {data.mode === 'applied' && returnsValue && (
        <Handle
          type="source"
          position={Position.Right}
          id="function-result"
          className="pointer-events-auto !right-[-6px] !h-3 !w-3 !bg-bw-sand"
          style={{ top: '50%' }}
        />
      )}
    </div>
  );
};
