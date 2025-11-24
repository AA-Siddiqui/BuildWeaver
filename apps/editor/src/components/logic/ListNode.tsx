import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { ListNodeData, ScalarValue } from '@buildweaver/libs';
import { NodeChrome } from './NodeChrome';
import { useNodeDataUpdater } from './hooks/useNodeDataUpdater';
import { parseScalarList, stringifyScalarList } from './valueParsers';
import { logicLogger } from '../../lib/logger';
import { usePreviewResolver } from './previewResolver';
import { formatScalar } from './preview';

const MAX_SAMPLE_LENGTH = 5;

const renderBindingPreview = (binding?: { value: unknown; sourceLabel: string }) => {
  if (!binding) {
    return null;
  }
  const readable = Array.isArray(binding.value)
    ? (binding.value as ScalarValue[]).map((item) => formatScalar(item)).join(', ')
    : formatScalar(binding.value as ScalarValue);
  return (
    <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
      <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
      <p className="text-white">{readable}</p>
      <p className="text-[10px] text-bw-platinum/60">{binding.sourceLabel}</p>
    </div>
  );
};

export const ListNode = ({ id, data }: NodeProps<ListNodeData>) => {
  const updateData = useNodeDataUpdater<ListNodeData>(id);
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const primaryHandleId = `list-${id}-primary`;
  const secondaryHandleId = `list-${id}-secondary`;
  const primaryBinding = previewResolver.getHandleBinding(id, primaryHandleId);
  const secondaryBinding = previewResolver.getHandleBinding(id, secondaryHandleId);

  const handleOperationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const operation = event.target.value as ListNodeData['operation'];
    logicLogger.info('List operation changed', { nodeId: id, operation });
    updateData((prev) => ({ ...prev, operation }));
  };

  const handleSampleChange = (key: 'primarySample' | 'secondarySample', event: ChangeEvent<HTMLTextAreaElement>) => {
    const parsed = parseScalarList(event.target.value, data.limit ?? MAX_SAMPLE_LENGTH);
    logicLogger.debug('List sample updated', { nodeId: id, key, size: parsed.length });
    updateData((prev) => ({ ...prev, [key]: parsed }));
  };

  const handleLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    const limit = Math.max(1, Math.min(MAX_SAMPLE_LENGTH, Number(event.target.value) || MAX_SAMPLE_LENGTH));
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
            className="bw-node-select mt-1 text-xs"
            value={data.operation}
            onChange={handleOperationChange}
          >
            <option value="append">Append</option>
            <option value="merge">Merge</option>
            <option value="slice">Slice</option>
            <option value="unique">Unique</option>
            <option value="sort">Sort</option>
            <option value="length">Length</option>
          </select>
        </label>
        <div className="space-y-2">
          <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Handle
              type="target"
              id={primaryHandleId}
              position={Position.Left}
              className="!left-[-6px] !h-3 !w-3 !bg-bw-platinum"
            />
            <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Primary sample</p>
            {renderBindingPreview(primaryBinding)}
            {!primaryBinding && (
              <textarea
                rows={3}
                className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
                value={stringifyScalarList(data.primarySample ?? [])}
                onChange={(event) => handleSampleChange('primarySample', event)}
              />
            )}
          </div>
          <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Handle
              type="target"
              id={secondaryHandleId}
              position={Position.Left}
              className="!left-[-6px] !h-3 !w-3 !bg-bw-platinum"
            />
            <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Secondary sample</p>
            {renderBindingPreview(secondaryBinding)}
            {!secondaryBinding && (
              <textarea
                rows={3}
                className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
                value={stringifyScalarList(data.secondarySample ?? [])}
                onChange={(event) => handleSampleChange('secondarySample', event)}
              />
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
            Preview limit
            <input
              type="number"
              min={1}
              max={MAX_SAMPLE_LENGTH}
              className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
              value={data.limit ?? MAX_SAMPLE_LENGTH}
              onChange={handleLimitChange}
            />
          </label>
          {data.operation === 'sort' && (
            <label className="flex flex-1 flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
              Sort
              <select
                className="bw-node-select mt-1 text-xs"
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
