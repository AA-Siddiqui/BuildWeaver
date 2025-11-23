import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { StringNodeData } from '@buildweaver/libs';
import { NodeChrome } from './NodeChrome';
import { evaluateStringPreview } from './preview';
import { useNodeDataUpdater } from './hooks/useNodeDataUpdater';
import { logicLogger } from '../../lib/logger';

const MAX_INPUTS = 4;
const MIN_INPUTS = 1;

const generateInputId = () => `str-${Math.random().toString(36).slice(2, 8)}`;

export const StringNode = ({ id, data }: NodeProps<StringNodeData>) => {
  const updateData = useNodeDataUpdater<StringNodeData>(id);
  const preview = evaluateStringPreview(data);

  const handleOperationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const operation = event.target.value as StringNodeData['operation'];
    logicLogger.info('String operation changed', { nodeId: id, operation });
    updateData((prev) => ({ ...prev, operation }));
  };

  const handleInputChange = (inputId: string, event: ChangeEvent<HTMLInputElement>) => {
    const sampleValue = event.target.value;
    logicLogger.debug('String input sample updated', { nodeId: id, inputId });
    updateData((prev) => ({
      ...prev,
      stringInputs: prev.stringInputs.map((input) => (input.id === inputId ? { ...input, sampleValue } : input))
    }));
  };

  const handleAddInput = () => {
    if (data.stringInputs.length >= MAX_INPUTS) {
      return;
    }
    const inputId = generateInputId();
    logicLogger.info('String input added', { nodeId: id, inputId });
    updateData((prev) => ({
      ...prev,
      stringInputs: prev.stringInputs.concat({ id: inputId, label: `Input ${prev.stringInputs.length + 1}`, sampleValue: '' })
    }));
  };

  const handleRemoveInput = (inputId: string) => {
    if (data.stringInputs.length <= MIN_INPUTS) {
      return;
    }
    logicLogger.warn('String input removed', { nodeId: id, inputId });
    updateData((prev) => ({
      ...prev,
      stringInputs: prev.stringInputs.filter((input) => input.id !== inputId)
    }));
  };

  const handleOptionChange = (key: 'delimiter' | 'start' | 'end' | 'search' | 'replace', value: string) => {
    logicLogger.debug('String option updated', { nodeId: id, key, value });
    updateData((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        [key]: key === 'start' || key === 'end' ? Number(value) || 0 : value
      }
    }));
  };

  const renderOptions = () => {
    switch (data.operation) {
      case 'concat':
        return (
          <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
            Delimiter
            <input
              type="text"
              className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
              value={data.options?.delimiter ?? ''}
              onChange={(event) => handleOptionChange('delimiter', event.target.value)}
            />
          </label>
        );
      case 'slice':
        return (
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
              Start
              <input
                type="number"
                className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
                value={data.options?.start ?? 0}
                onChange={(event) => handleOptionChange('start', event.target.value)}
              />
            </label>
            <label className="flex flex-1 flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
              End
              <input
                type="number"
                className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
                value={data.options?.end ?? 0}
                onChange={(event) => handleOptionChange('end', event.target.value)}
              />
            </label>
          </div>
        );
      case 'replace':
        return (
          <div className="space-y-2">
            <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
              Search
              <input
                type="text"
                className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
                value={data.options?.search ?? ''}
                onChange={(event) => handleOptionChange('search', event.target.value)}
              />
            </label>
            <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
              Replace
              <input
                type="text"
                className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
                value={data.options?.replace ?? ''}
                onChange={(event) => handleOptionChange('replace', event.target.value)}
              />
            </label>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      <NodeChrome badge="String" label={data.label} description={data.description ?? 'String utilities'} preview={preview}>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
          Operation
          <select
            className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
            value={data.operation}
            onChange={handleOperationChange}
          >
            <option value="concat">Concatenate</option>
            <option value="uppercase">Uppercase</option>
            <option value="lowercase">Lowercase</option>
            <option value="trim">Trim</option>
            <option value="slice">Slice</option>
            <option value="replace">Replace</option>
            <option value="length">Length</option>
          </select>
        </label>
        <div className="space-y-2">
          {data.stringInputs.map((input, index) => (
            <div key={input.id} className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <Handle
                type="target"
                id={`string-${input.id}`}
                position={Position.Left}
                className="!left-[-6px] !h-3 !w-3 !bg-bw-platinum"
              />
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">
                <span>
                  {input.label}
                  <span className="ml-1 text-[10px] lowercase text-bw-platinum/40">#{index + 1}</span>
                </span>
                {data.stringInputs.length > MIN_INPUTS && (
                  <button type="button" className="text-bw-sand" onClick={() => handleRemoveInput(input.id)}>
                    ×
                  </button>
                )}
              </div>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
                value={input.sampleValue ?? ''}
                onChange={(event) => handleInputChange(input.id, event)}
              />
            </div>
          ))}
          <button
            type="button"
            className="w-full rounded-xl border border-dashed border-white/20 py-2 text-xs text-white/70"
            onClick={handleAddInput}
            disabled={data.stringInputs.length >= MAX_INPUTS}
          >
            Add input
          </button>
        </div>
        {renderOptions()}
      </NodeChrome>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-bw-sand" id={`string-${id}-out`} />
    </div>
  );
};
