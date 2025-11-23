import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { ObjectNodeData } from '@buildweaver/libs';
import { NodeChrome } from './NodeChrome';
import { evaluateObjectPreview } from './preview';
import { useNodeDataUpdater } from './hooks/useNodeDataUpdater';
import { parseKeyValuePairs, stringifyKeyValuePairs } from './valueParsers';
import { logicLogger } from '../../lib/logger';

export const ObjectNode = ({ id, data }: NodeProps<ObjectNodeData>) => {
  const updateData = useNodeDataUpdater<ObjectNodeData>(id);
  const preview = evaluateObjectPreview(data);

  const handleOperationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const operation = event.target.value as ObjectNodeData['operation'];
    logicLogger.info('Object operation changed', { nodeId: id, operation });
    updateData((prev) => ({ ...prev, operation }));
  };

  const handleSampleChange = (key: 'sourceSample' | 'patchSample', event: ChangeEvent<HTMLTextAreaElement>) => {
    const parsed = parseKeyValuePairs(event.target.value, 5);
    logicLogger.debug('Object sample updated', { nodeId: id, key, size: Object.keys(parsed).length });
    updateData((prev) => ({ ...prev, [key]: parsed }));
  };

  const handlePathChange = (event: ChangeEvent<HTMLInputElement>) => {
    const path = event.target.value;
    logicLogger.debug('Object path updated', { nodeId: id, path });
    updateData((prev) => ({ ...prev, path }));
  };

  const handleSelectedKeysChange = (event: ChangeEvent<HTMLInputElement>) => {
    const keys = event.target.value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 5);
    logicLogger.debug('Object keys updated', { nodeId: id, keysCount: keys.length });
    updateData((prev) => ({ ...prev, selectedKeys: keys }));
  };

  return (
    <div className="relative">
      <NodeChrome badge="Object" label={data.label} description={data.description ?? 'Object utilities'} preview={preview}>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
          Operation
          <select
            className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
            value={data.operation}
            onChange={handleOperationChange}
          >
            <option value="merge">Merge</option>
            <option value="pick">Pick</option>
            <option value="set">Set</option>
            <option value="get">Get</option>
            <option value="keys">Keys</option>
            <option value="values">Values</option>
          </select>
        </label>
        <div className="space-y-2">
          <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Handle type="target" id={`object-${id}-source`} position={Position.Left} className="!left-[-6px] !h-3 !w-3 !bg-bw-platinum" />
            <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Source sample</p>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
              value={stringifyKeyValuePairs(data.sourceSample ?? {})}
              onChange={(event) => handleSampleChange('sourceSample', event)}
            />
          </div>
          <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Handle type="target" id={`object-${id}-patch`} position={Position.Left} className="!left-[-6px] !h-3 !w-3 !bg-bw-platinum" />
            <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Patch sample</p>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
              value={stringifyKeyValuePairs(data.patchSample ?? {})}
              onChange={(event) => handleSampleChange('patchSample', event)}
            />
          </div>
        </div>
        {(data.operation === 'set' || data.operation === 'get') && (
          <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
            Key path
            <input
              type="text"
              className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
              value={data.path ?? ''}
              onChange={handlePathChange}
            />
          </label>
        )}
        {data.operation === 'pick' && (
          <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
            Keys (comma separated)
            <input
              type="text"
              className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
              value={(data.selectedKeys ?? []).join(', ')}
              onChange={handleSelectedKeysChange}
            />
          </label>
        )}
      </NodeChrome>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-bw-sand" id={`object-${id}-out`} />
    </div>
  );
};
