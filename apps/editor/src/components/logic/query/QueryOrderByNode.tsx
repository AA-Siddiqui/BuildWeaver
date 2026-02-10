import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import type { QueryOrderByNodeData, SqlSortOrder } from '@buildweaver/libs';
import { NodeChrome } from '../NodeChrome';
import { useNodeDataUpdater } from '../hooks/useNodeDataUpdater';
import { usePreviewResolver } from '../previewResolver';
import { useQuerySchema } from './QuerySchemaContext';
import { logicLogger } from '../../../lib/logger';

const LOGGER_PREFIX = 'QueryOrderByNode';

export const QueryOrderByNode = ({ id, data }: NodeProps<QueryOrderByNodeData>) => {
  const updateData = useNodeDataUpdater<QueryOrderByNodeData>(id);
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const { tables } = useQuerySchema();

  const bindingData = previewResolver.getHandleBinding(id, 'input-data');
  const allFields = tables.flatMap(t => t.fields.map(f => `${t.name}.${f.name}`));

  const handleAddSort = () => {
    logicLogger.info(`[${LOGGER_PREFIX}] sort criterion added`, { nodeId: id });
    updateData((prev) => ({
      ...prev,
      sortCount: prev.sortCount + 1,
      sortAttributes: [...prev.sortAttributes, ''],
      sortOrders: [...prev.sortOrders, 'asc' as SqlSortOrder]
    }));
  };

  const handleRemoveSort = (index: number) => {
    if (data.sortCount <= 1) return;
    logicLogger.info(`[${LOGGER_PREFIX}] sort criterion removed`, { nodeId: id, index });
    updateData((prev) => ({
      ...prev,
      sortCount: Math.max(1, prev.sortCount - 1),
      sortAttributes: prev.sortAttributes.filter((_, i) => i !== index),
      sortOrders: prev.sortOrders.filter((_, i) => i !== index)
    }));
  };

  const handleSortAttributeChange = (index: number, event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    logicLogger.debug(`[${LOGGER_PREFIX}] sort attribute changed`, { nodeId: id, index, value });
    updateData((prev) => {
      const sortAttributes = [...prev.sortAttributes];
      sortAttributes[index] = value;
      return { ...prev, sortAttributes };
    });
  };

  const handleSortOrderChange = (index: number, order: SqlSortOrder) => {
    logicLogger.debug(`[${LOGGER_PREFIX}] sort order changed`, { nodeId: id, index, order });
    updateData((prev) => {
      const sortOrders = [...prev.sortOrders];
      sortOrders[index] = order;
      return { ...prev, sortOrders };
    });
  };

  return (
    <div className="relative">
      <NodeChrome badge="ORDER BY" label="Order By" description="SQL ORDER BY clause" preview={preview}>
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

        {/* Sort criteria */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Sort criteria</p>
          {Array.from({ length: data.sortCount }, (_, i) => {
            const handleAttrId = `input-sort-attr-${i}`;
            const handleOrderId = `input-sort-order-${i}`;
            const bindingAttr = previewResolver.getHandleBinding(id, handleAttrId);
            const bindingOrder = previewResolver.getHandleBinding(id, handleOrderId);
            return (
              <div key={i} className="relative space-y-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                {/* Attribute handle */}
                <Handle
                  type="target"
                  id={handleAttrId}
                  position={Position.Left}
                  className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
                />
                {/* Order handle */}
                <Handle
                  type="target"
                  id={handleOrderId}
                  position={Position.Left}
                  className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
                  style={{ top: '75%' }}
                />
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-bw-platinum/60">Sort #{i + 1}</p>
                  {data.sortCount > 1 && (
                    <button
                      type="button"
                      className="text-bw-sand text-xs"
                      onClick={() => handleRemoveSort(i)}
                    >
                      x
                    </button>
                  )}
                </div>

                {/* Attribute */}
                {bindingAttr ? (
                  <div className="rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
                    <p className="text-[10px] text-bw-platinum/60">{bindingAttr.sourceLabel}</p>
                  </div>
                ) : (
                  <select
                    className="bw-node-select text-xs"
                    value={data.sortAttributes[i] ?? ''}
                    onChange={(event) => handleSortAttributeChange(i, event)}
                  >
                    <option value="">-- Select attribute --</option>
                    {allFields.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                )}

                {/* Order */}
                {bindingOrder ? (
                  <div className="rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
                    <p className="text-[10px] text-bw-platinum/60">{bindingOrder.sourceLabel}</p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1 text-xs text-white">
                      <input
                        type="radio"
                        name={`sort-order-${id}-${i}`}
                        checked={data.sortOrders[i] === 'asc'}
                        onChange={() => handleSortOrderChange(i, 'asc')}
                        className="accent-bw-amber"
                      />
                      ASC
                    </label>
                    <label className="flex items-center gap-1 text-xs text-white">
                      <input
                        type="radio"
                        name={`sort-order-${id}-${i}`}
                        checked={data.sortOrders[i] === 'desc'}
                        onChange={() => handleSortOrderChange(i, 'desc')}
                        className="accent-bw-amber"
                      />
                      DESC
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="w-full rounded-xl border border-dashed border-white/20 py-2 text-xs text-white/70"
          onClick={handleAddSort}
        >
          + Add sort criterion
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
