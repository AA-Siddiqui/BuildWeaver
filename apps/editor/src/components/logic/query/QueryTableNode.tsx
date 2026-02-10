import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import type { QueryTableNodeData } from '@buildweaver/libs';
import { NodeChrome } from '../NodeChrome';
import { useNodeDataUpdater } from '../hooks/useNodeDataUpdater';
import { useCursorRestorer } from '../hooks/useCursorRestorer';
import { usePreviewResolver } from '../previewResolver';
import { useQuerySchema } from './QuerySchemaContext';
import { logicLogger } from '../../../lib/logger';

const LOGGER_PREFIX = 'QueryTableNode';

export const QueryTableNode = ({ id, data }: NodeProps<QueryTableNodeData>) => {
  const updateData = useNodeDataUpdater<QueryTableNodeData>(id);
  const restoreCursor = useCursorRestorer();
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const { tables, mode, getTableFields } = useQuerySchema();

  const fields = getTableFields(data.tableName);

  const handleTableChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const tableName = event.target.value;
    const table = tables.find(t => t.name === tableName);
    logicLogger.info(`[${LOGGER_PREFIX}] table changed`, { nodeId: id, tableName });
    updateData((prev) => ({
      ...prev,
      tableName,
      tableId: table?.id ?? prev.tableId,
      selectedColumns: [],
      columnDefaults: {},
      aggregationInputCount: prev.aggregationInputCount
    }));
  };

  const handleColumnToggle = (colName: string) => {
    logicLogger.debug(`[${LOGGER_PREFIX}] column toggled`, { nodeId: id, colName });
    updateData((prev) => {
      const isSelected = prev.selectedColumns.includes(colName);
      const selectedColumns = isSelected
        ? prev.selectedColumns.filter(c => c !== colName)
        : [...prev.selectedColumns, colName];
      return { ...prev, selectedColumns };
    });
  };

  const handleColumnDefaultChange = (colName: string, event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    logicLogger.debug(`[${LOGGER_PREFIX}] column default changed`, { nodeId: id, colName, value });
    updateData((prev) => ({
      ...prev,
      columnDefaults: { ...prev.columnDefaults, [colName]: value }
    }));
    restoreCursor(event.target, { nodeId: id, field: `col-default-${colName}` });
  };

  const handleAddAggregation = () => {
    logicLogger.info(`[${LOGGER_PREFIX}] aggregation input added`, { nodeId: id });
    updateData((prev) => ({
      ...prev,
      aggregationInputCount: prev.aggregationInputCount + 1
    }));
  };

  const handleRemoveAggregation = () => {
    if (data.aggregationInputCount <= 0) return;
    logicLogger.info(`[${LOGGER_PREFIX}] aggregation input removed`, { nodeId: id });
    updateData((prev) => ({
      ...prev,
      aggregationInputCount: Math.max(0, prev.aggregationInputCount - 1)
    }));
  };

  const renderReadMode = () => (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Columns (SELECT)</p>
      {fields.map((field) => {
        const checked = data.selectedColumns.includes(field.name);
        return (
          <label key={field.name} className="flex items-center gap-2 text-xs text-white">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => handleColumnToggle(field.name)}
              className="accent-bw-amber"
            />
            <span>{field.name}</span>
            <span className="text-[10px] text-bw-platinum/50">{field.type}</span>
          </label>
        );
      })}
    </div>
  );

  const renderInsertMode = () => (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Values (INSERT)</p>
      {fields.map((field) => {
        const handleId = `input-col-${field.name}`;
        const binding = previewResolver.getHandleBinding(id, handleId);
        return (
          <div key={field.name} className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Handle
              type="target"
              id={handleId}
              position={Position.Left}
              className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
            />
            <p className="text-[11px] text-bw-platinum/60">
              {field.name} <span className="text-[10px] text-bw-platinum/40">({field.type})</span>
            </p>
            {binding ? (
              <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
                <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
                <p className="text-[10px] text-bw-platinum/60">{binding.sourceLabel}</p>
              </div>
            ) : (
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
                value={data.columnDefaults[field.name] ?? ''}
                onChange={(event) => handleColumnDefaultChange(field.name, event)}
                placeholder={`Default for ${field.name}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderUpdateMode = () => (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Columns (UPDATE)</p>
      {fields.map((field) => {
        const checked = data.selectedColumns.includes(field.name);
        const handleId = `input-col-${field.name}`;
        const binding = checked ? previewResolver.getHandleBinding(id, handleId) : undefined;
        return (
          <div key={field.name} className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            {checked && (
              <Handle
                type="target"
                id={handleId}
                position={Position.Left}
                className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
              />
            )}
            <label className="flex items-center gap-2 text-xs text-white">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => handleColumnToggle(field.name)}
                className="accent-bw-amber"
              />
              <span>{field.name}</span>
              <span className="text-[10px] text-bw-platinum/50">{field.type}</span>
            </label>
            {checked && !binding && (
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
                value={data.columnDefaults[field.name] ?? ''}
                onChange={(event) => handleColumnDefaultChange(field.name, event)}
                placeholder={`Value for ${field.name}`}
              />
            )}
            {checked && binding && (
              <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
                <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
                <p className="text-[10px] text-bw-platinum/60">{binding.sourceLabel}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderDeleteMode = () => (
    <div>
      <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-bw-platinum">
        DELETE from <span className="font-semibold text-white">{data.tableName || '(select table)'}</span>.
        Connect a WHERE node to filter rows.
      </p>
    </div>
  );

  const renderModeContent = () => {
    switch (mode) {
      case 'read':
        return renderReadMode();
      case 'insert':
        return renderInsertMode();
      case 'update':
        return renderUpdateMode();
      case 'delete':
        return renderDeleteMode();
      default:
        return renderReadMode();
    }
  };

  return (
    <div className="relative">
      <div className="w-72">
        <NodeChrome badge="TABLE" label={data.tableName || 'Table'} description="Reference a database table" preview={preview}>
          <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
            Table
            <select
              className="bw-node-select mt-1 text-xs"
              value={data.tableName}
              onChange={handleTableChange}
            >
              <option value="">-- Select table --</option>
              {tables.map((table) => (
                <option key={table.id} value={table.name}>{table.name}</option>
              ))}
            </select>
          </label>

          {data.tableName && renderModeContent()}

          {/* Aggregation input handles */}
          {data.aggregationInputCount > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Aggregations</p>
              {Array.from({ length: data.aggregationInputCount }, (_, i) => {
                const handleId = `input-agg-${i}`;
                const binding = previewResolver.getHandleBinding(id, handleId);
                return (
                  <div key={i} className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <Handle
                      type="target"
                      id={handleId}
                      position={Position.Left}
                      className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
                    />
                    <p className="text-[11px] text-bw-platinum/60">Aggregation #{i + 1}</p>
                    {binding && (
                      <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
                        <p className="text-[10px] text-bw-platinum/60">{binding.sourceLabel}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-xl border border-dashed border-white/20 py-1 text-xs text-white/70"
              onClick={handleAddAggregation}
            >
              + Aggregation
            </button>
            {data.aggregationInputCount > 0 && (
              <button
                type="button"
                className="rounded-xl border border-dashed border-white/20 px-2 py-1 text-xs text-white/70"
                onClick={handleRemoveAggregation}
              >
                -
              </button>
            )}
          </div>
        </NodeChrome>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!right-14 !h-3 !w-3 !rounded-full !bg-[#DDC57A]"
      />
    </div>
  );
};
