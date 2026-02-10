import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import type { QueryGroupByNodeData } from '@buildweaver/libs';
import { NodeChrome } from '../NodeChrome';
import { useNodeDataUpdater } from '../hooks/useNodeDataUpdater';
import { usePreviewResolver } from '../previewResolver';
import { useQuerySchema } from './QuerySchemaContext';
import { logicLogger } from '../../../lib/logger';

const LOGGER_PREFIX = 'QueryGroupByNode';

export const QueryGroupByNode = ({ id, data }: NodeProps<QueryGroupByNodeData>) => {
  const updateData = useNodeDataUpdater<QueryGroupByNodeData>(id);
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const { tables } = useQuerySchema();

  const bindingData = previewResolver.getHandleBinding(id, 'input-data');
  const allFields = tables.flatMap(t => t.fields.map(f => `${t.name}.${f.name}`));

  const handleAddGroup = () => {
    logicLogger.info(`[${LOGGER_PREFIX}] grouping attribute added`, { nodeId: id });
    updateData((prev) => ({
      ...prev,
      groupingAttributeCount: prev.groupingAttributeCount + 1,
      attributes: [...prev.attributes, '']
    }));
  };

  const handleRemoveGroup = (index: number) => {
    if (data.groupingAttributeCount <= 1) return;
    logicLogger.info(`[${LOGGER_PREFIX}] grouping attribute removed`, { nodeId: id, index });
    updateData((prev) => ({
      ...prev,
      groupingAttributeCount: Math.max(1, prev.groupingAttributeCount - 1),
      attributes: prev.attributes.filter((_, i) => i !== index)
    }));
  };

  const handleAttributeChange = (index: number, event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    logicLogger.debug(`[${LOGGER_PREFIX}] attribute changed`, { nodeId: id, index, value });
    updateData((prev) => {
      const attributes = [...prev.attributes];
      attributes[index] = value;
      return { ...prev, attributes };
    });
  };

  return (
    <div className="relative">
      <NodeChrome badge="GROUP BY" label="Group By" description="SQL GROUP BY clause" preview={preview}>
        {/* Data input */}
        <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Handle
            type="target"
            id="input-data"
            position={Position.Left}
            className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Data input</p>
          {bindingData && (
            <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
              <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
              <p className="text-[10px] text-bw-platinum/60">{bindingData.sourceLabel}</p>
            </div>
          )}
        </div>

        {/* Grouping attributes */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Grouping attributes</p>
          {Array.from({ length: data.groupingAttributeCount }, (_, i) => {
            const handleId = `input-group-${i}`;
            const binding = previewResolver.getHandleBinding(id, handleId);
            return (
              <div key={i} className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <Handle
                  type="target"
                  id={handleId}
                  position={Position.Left}
                  className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
                />
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-bw-platinum/60">Group #{i + 1}</p>
                  {data.groupingAttributeCount > 1 && (
                    <button
                      type="button"
                      className="text-bw-sand text-xs"
                      onClick={() => handleRemoveGroup(i)}
                    >
                      x
                    </button>
                  )}
                </div>
                {binding ? (
                  <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
                    <p className="text-[10px] text-bw-platinum/60">{binding.sourceLabel}</p>
                  </div>
                ) : (
                  <select
                    className="bw-node-select mt-1 text-xs"
                    value={data.attributes[i] ?? ''}
                    onChange={(event) => handleAttributeChange(i, event)}
                  >
                    <option value="">-- Select attribute --</option>
                    {allFields.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="w-full rounded-xl border border-dashed border-white/20 py-2 text-xs text-white/70"
          onClick={handleAddGroup}
        >
          + Add grouping attribute
        </button>
      </NodeChrome>
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!right-[-6px] !h-3 !w-3 !rounded-full !bg-[#DDC57A]"
      />
    </div>
  );
};
