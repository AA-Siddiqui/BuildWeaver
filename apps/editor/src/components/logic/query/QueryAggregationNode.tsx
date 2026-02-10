import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import type { QueryAggregationNodeData, SqlAggregateFunction } from '@buildweaver/libs';
import { NodeChrome } from '../NodeChrome';
import { useNodeDataUpdater } from '../hooks/useNodeDataUpdater';
import { usePreviewResolver } from '../previewResolver';
import { useQuerySchema } from './QuerySchemaContext';
import { logicLogger } from '../../../lib/logger';

const LOGGER_PREFIX = 'QueryAggregationNode';

export const QueryAggregationNode = ({ id, data }: NodeProps<QueryAggregationNodeData>) => {
  const updateData = useNodeDataUpdater<QueryAggregationNodeData>(id);
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const { tables } = useQuerySchema();

  const allFields = tables.flatMap(t => t.fields.map(f => ({ table: t.name, field: f.name, label: `${t.name}.${f.name}` })));

  const handleFunctionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const fn = event.target.value as SqlAggregateFunction;
    logicLogger.info(`[${LOGGER_PREFIX}] function changed`, { nodeId: id, function: fn });
    updateData((prev) => ({ ...prev, function: fn }));
  };

  const handleAttributeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const parts = value.split('.');
    const tableName = parts.length > 1 ? parts[0] : undefined;
    const attribute = parts.length > 1 ? parts[1] : value;
    logicLogger.debug(`[${LOGGER_PREFIX}] attribute changed`, { nodeId: id, tableName, attribute });
    updateData((prev) => ({ ...prev, attribute, tableName }));
  };

  const currentValue = data.tableName && data.attribute
    ? `${data.tableName}.${data.attribute}`
    : data.attribute ?? '';

  return (
    <div className="relative">
      <NodeChrome badge="AGG" label="Aggregation" description="SQL aggregate function" preview={preview}>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
          Function
          <select
            className="bw-node-select mt-1 text-xs"
            value={data.function}
            onChange={handleFunctionChange}
          >
            <option value="sum">SUM</option>
            <option value="max">MAX</option>
            <option value="min">MIN</option>
            <option value="count">COUNT</option>
            <option value="avg">AVG</option>
          </select>
        </label>

        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
          Attribute
          <select
            className="bw-node-select mt-1 text-xs"
            value={currentValue}
            onChange={handleAttributeChange}
          >
            <option value="">-- Select attribute --</option>
            {data.function === 'count' && <option value="*">* (all rows)</option>}
            {allFields.map((f) => (
              <option key={f.label} value={f.label}>{f.label}</option>
            ))}
          </select>
        </label>
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
