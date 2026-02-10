import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import type { QueryJoinNodeData, SqlJoinType } from '@buildweaver/libs';
import { NodeChrome } from '../NodeChrome';
import { useNodeDataUpdater } from '../hooks/useNodeDataUpdater';
import { usePreviewResolver } from '../previewResolver';
import { useQuerySchema } from './QuerySchemaContext';
import { logicLogger } from '../../../lib/logger';

const LOGGER_PREFIX = 'QueryJoinNode';

export const QueryJoinNode = ({ id, data }: NodeProps<QueryJoinNodeData>) => {
  const updateData = useNodeDataUpdater<QueryJoinNodeData>(id);
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const { tables, getTableFields } = useQuerySchema();

  const bindingA = previewResolver.getHandleBinding(id, 'input-a');
  const bindingB = previewResolver.getHandleBinding(id, 'input-b');
  const bindingAttrA = previewResolver.getHandleBinding(id, 'input-attr-a');
  const bindingAttrB = previewResolver.getHandleBinding(id, 'input-attr-b');

  const fieldsA = getTableFields(data.tableA ?? '');
  const fieldsB = getTableFields(data.tableB ?? '');

  const handleJoinTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const joinType = event.target.value as SqlJoinType;
    logicLogger.info(`[${LOGGER_PREFIX}] join type changed`, { nodeId: id, joinType });
    updateData((prev) => ({ ...prev, joinType }));
  };

  const handleTableAChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const tableA = event.target.value;
    logicLogger.debug(`[${LOGGER_PREFIX}] table A changed`, { nodeId: id, tableA });
    updateData((prev) => ({ ...prev, tableA, attributeA: undefined }));
  };

  const handleTableBChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const tableB = event.target.value;
    logicLogger.debug(`[${LOGGER_PREFIX}] table B changed`, { nodeId: id, tableB });
    updateData((prev) => ({ ...prev, tableB, attributeB: undefined }));
  };

  const handleAttrAChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const attributeA = event.target.value;
    logicLogger.debug(`[${LOGGER_PREFIX}] attribute A changed`, { nodeId: id, attributeA });
    updateData((prev) => ({ ...prev, attributeA }));
  };

  const handleAttrBChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const attributeB = event.target.value;
    logicLogger.debug(`[${LOGGER_PREFIX}] attribute B changed`, { nodeId: id, attributeB });
    updateData((prev) => ({ ...prev, attributeB }));
  };

  return (
    <div className="relative">
      <NodeChrome badge="JOIN" label="Join" description="SQL JOIN clause" preview={preview}>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
          Join type
          <select
            className="bw-node-select mt-1 text-xs"
            value={data.joinType}
            onChange={handleJoinTypeChange}
          >
            <option value="inner">Inner Join</option>
            <option value="left">Left Join</option>
            <option value="right">Right Join</option>
            <option value="full">Full Join</option>
          </select>
        </label>

        {/* Table A input */}
        <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Handle
            type="target"
            id="input-a"
            position={Position.Left}
            className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
            style={{ top: '30%' }}
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Table A</p>
          {bindingA ? (
            <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
              <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
              <p className="text-[10px] text-bw-platinum/60">{bindingA.sourceLabel}</p>
            </div>
          ) : (
            <select
              className="bw-node-select mt-1 text-xs"
              value={data.tableA ?? ''}
              onChange={handleTableAChange}
            >
              <option value="">-- Select --</option>
              {tables.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Table B input */}
        <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Handle
            type="target"
            id="input-b"
            position={Position.Left}
            className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
            style={{ top: '45%' }}
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Table B</p>
          {bindingB ? (
            <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
              <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
              <p className="text-[10px] text-bw-platinum/60">{bindingB.sourceLabel}</p>
            </div>
          ) : (
            <select
              className="bw-node-select mt-1 text-xs"
              value={data.tableB ?? ''}
              onChange={handleTableBChange}
            >
              <option value="">-- Select --</option>
              {tables.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Attribute A input */}
        <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Handle
            type="target"
            id="input-attr-a"
            position={Position.Left}
            className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
            style={{ top: '60%' }}
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Attribute A</p>
          {bindingAttrA ? (
            <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
              <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
              <p className="text-[10px] text-bw-platinum/60">{bindingAttrA.sourceLabel}</p>
            </div>
          ) : (
            <select
              className="bw-node-select mt-1 text-xs"
              value={data.attributeA ?? ''}
              onChange={handleAttrAChange}
            >
              <option value="">-- Select --</option>
              {fieldsA.map((f) => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Attribute B input */}
        <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Handle
            type="target"
            id="input-attr-b"
            position={Position.Left}
            className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
            style={{ top: '75%' }}
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Attribute B</p>
          {bindingAttrB ? (
            <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
              <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
              <p className="text-[10px] text-bw-platinum/60">{bindingAttrB.sourceLabel}</p>
            </div>
          ) : (
            <select
              className="bw-node-select mt-1 text-xs"
              value={data.attributeB ?? ''}
              onChange={handleAttrBChange}
            >
              <option value="">-- Select --</option>
              {fieldsB.map((f) => (
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
