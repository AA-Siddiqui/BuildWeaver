import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import type { QueryAttributeNodeData } from '@buildweaver/libs';
import { NodeChrome } from '../NodeChrome';
import { useNodeDataUpdater } from '../hooks/useNodeDataUpdater';
import { usePreviewResolver } from '../previewResolver';
import { useQuerySchema } from './QuerySchemaContext';
import { logicLogger } from '../../../lib/logger';

const LOGGER_PREFIX = 'QueryAttributeNode';

export const QueryAttributeNode = ({ id, data }: NodeProps<QueryAttributeNodeData>) => {
  const updateData = useNodeDataUpdater<QueryAttributeNodeData>(id);
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const { tables, getTableFields } = useQuerySchema();

  const bindingTable = previewResolver.getHandleBinding(id, 'input-table');
  const bindingAttr = previewResolver.getHandleBinding(id, 'input-attr');

  const fields = getTableFields(data.tableName ?? '');

  const handleTableChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const tableName = event.target.value;
    logicLogger.info(`[${LOGGER_PREFIX}] table changed`, { nodeId: id, tableName });
    updateData((prev) => ({ ...prev, tableName, attributeName: undefined }));
  };

  const handleAttributeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const attributeName = event.target.value;
    logicLogger.debug(`[${LOGGER_PREFIX}] attribute changed`, { nodeId: id, attributeName });
    updateData((prev) => ({ ...prev, attributeName }));
  };

  return (
    <div className="relative">
      <NodeChrome badge="ATTR" label="Attribute" description="Reference a table column" preview={preview}>
        {/* Table input */}
        <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Handle
            type="target"
            id="input-table"
            position={Position.Left}
            className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Table</p>
          {bindingTable ? (
            <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
              <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
              <p className="text-[10px] text-bw-platinum/60">{bindingTable.sourceLabel}</p>
            </div>
          ) : (
            <select
              className="bw-node-select mt-1 text-xs"
              value={data.tableName ?? ''}
              onChange={handleTableChange}
            >
              <option value="">-- Select table --</option>
              {tables.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Attribute input */}
        <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Handle
            type="target"
            id="input-attr"
            position={Position.Left}
            className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Attribute</p>
          {bindingAttr ? (
            <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
              <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
              <p className="text-[10px] text-bw-platinum/60">{bindingAttr.sourceLabel}</p>
            </div>
          ) : (
            <select
              className="bw-node-select mt-1 text-xs"
              value={data.attributeName ?? ''}
              onChange={handleAttributeChange}
            >
              <option value="">-- Select attribute --</option>
              {fields.map((f) => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
            </select>
          )}
        </div>
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
