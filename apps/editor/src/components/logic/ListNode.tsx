import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { ListNodeData } from '@buildweaver/libs';
import { NodeChrome } from './NodeChrome';
import { evaluateListPreview } from './preview';
import { useNodeDataUpdater } from './hooks/useNodeDataUpdater';
import { parseScalarList, stringifyScalarList } from './valueParsers';
import { logicLogger } from '../../lib/logger';

export const ListNode = ({ id, data }: NodeProps<ListNodeData>) => {
  const updateData = useNodeDataUpdater<ListNodeData>(id);
  const preview = evaluateListPreview(data);

  const handleOperationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const operation = event.target.value as ListNodeData['operation'];
    logicLogger.info('List operation changed', { nodeId: id, operation });
    updateData((prev) => ({ ...prev, operation }));
  };

  const handleSampleChange = (key: 'primarySample' | 'secondarySample', event: ChangeEvent<HTMLTextAreaElement>) => {
    const parsed = parseScalarList(event.target.value, data.limit ?? 5);
    logicLogger.debug('List sample updated', { nodeId: id, key, size: parsed.length });
    updateData((prev) => ({ ...prev, [key]: parsed }));
  };

  const handleLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    const limit = Math.max(1, Math.min(5, Number(event.target.value) || 5));
    logicLogger.debug('List preview limit updated', { nodeId: id, limit });
    updateData((prev) => ({ ...prev, limit }));
  };

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const sort = event.target.value as ListNodeData['sort'];
    logicLogger.debug('List sort updated', { nodeId: id, sort });
    updateData((prev) => ({ ...prev, sort }));
  };

  return (
    <div className="relative">
      <NodeChrome badge="List" label={data.label} description={data.description ?? 'List utilities'} preview={preview}>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
          Operation
          <select
            className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
            value={data.operation}
            onChange={handleOperationChange}
          >
            <option value="append">Append</option>
            <option value="merge">Merge</option>
            <option value="slice">Slice</option>
            <option value="take">Take</option>
            <option value="unique">Unique</option>
            <option value="sort">Sort</option>
            <option value="length">Length</option>
          </select>
        </label>
        <div className="space-y-2">
          <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Handle type="target" id={`list-${id}-primary`} position={Position.Left} className="!left-[-6px] !h-3 !w-3 !bg-bw-platinum" />
            <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Primary sample</p>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
              value={stringifyScalarList(data.primarySample ?? [])}
              onChange={(event) => handleSampleChange('primarySample', event)}
            />
          </div>
          <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Handle type="target" id={`list-${id}-secondary`} position={Position.Left} className="!left-[-6px] !h-3 !w-3 !bg-bw-platinum" />
            <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Secondary sample</p>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
              value={stringifyScalarList(data.secondarySample ?? [])}
              onChange={(event) => handleSampleChange('secondarySample', event)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
            Preview limit
            <input
              type="number"
              min={1}
              max={5}
              className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
              value={data.limit ?? 5}
              onChange={handleLimitChange}
            />
          </label>
          {data.operation === 'sort' && (
            <label className="flex flex-1 flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
              Sort
              <select
                className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
                value={data.sort ?? 'asc'}
                onChange={handleSortChange}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
          )}
        </div>
      </NodeChrome>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-bw-sand" id={`list-${id}-out`} />
    </div>
  );
};
