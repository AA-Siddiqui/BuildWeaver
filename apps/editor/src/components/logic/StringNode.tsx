import { ChangeEvent, useEffect } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { ScalarValue, StringNodeData, StringNodeInput, StringNodeInputRole } from '@buildweaver/libs';
import { NodeChrome } from './NodeChrome';
import { useNodeDataUpdater } from './hooks/useNodeDataUpdater';
import { logicLogger } from '../../lib/logger';
import { usePreviewResolver } from './previewResolver';
import { formatScalar } from './preview';

const generateInputId = () => `str-${Math.random().toString(36).slice(2, 8)}`;

type NormalizedStringNodeInput = StringNodeInput & { role: StringNodeInputRole };

type OperationConfig = {
  text: {
    min: number;
    max: number;
    labels: string[];
  };
  staticInputs?: Array<{ role: StringNodeInputRole; label: string }>;
};

const STRING_OPERATION_CONFIG: Record<StringNodeData['operation'], OperationConfig> = {
  concat: {
    text: { min: 2, max: 4, labels: ['Text 1', 'Text 2', 'Text 3', 'Text 4'] },
    staticInputs: [{ role: 'delimiter', label: 'Delimiter' }]
  },
  uppercase: { text: { min: 1, max: 1, labels: ['Text'] } },
  lowercase: { text: { min: 1, max: 1, labels: ['Text'] } },
  trim: { text: { min: 1, max: 1, labels: ['Text'] } },
  length: { text: { min: 1, max: 1, labels: ['Text'] } },
  replace: {
    text: { min: 1, max: 1, labels: ['Text'] },
    staticInputs: [
      { role: 'search', label: 'Search' },
      { role: 'replace', label: 'Replace' }
    ]
  },
  slice: {
    text: { min: 1, max: 1, labels: ['Text'] },
    staticInputs: [
      { role: 'start', label: 'Start' },
      { role: 'end', label: 'End' }
    ]
  }
};

const getOperationConfig = (operation: StringNodeData['operation']): OperationConfig => {
  return STRING_OPERATION_CONFIG[operation] ?? STRING_OPERATION_CONFIG.concat;
};

const getInputRole = (input: StringNodeInput): StringNodeInputRole => input.role ?? 'text';

const getOptionsFallback = (role: StringNodeInputRole, options?: StringNodeData['options']): string => {
  if (!options) {
    return '';
  }
  switch (role) {
    case 'delimiter':
      return options.delimiter ?? '';
    case 'search':
      return options.search ?? '';
    case 'replace':
      return options.replace ?? '';
    case 'start':
      return options.start !== undefined ? String(options.start) : '';
    case 'end':
      return options.end !== undefined ? String(options.end) : '';
    default:
      return '';
  }
};

const createStringInput = (
  label: string,
  role: StringNodeInputRole = 'text',
  sampleValue = ''
): NormalizedStringNodeInput => ({
  id: generateInputId(),
  label,
  role,
  sampleValue
});

const enforceStringInputs = (data: StringNodeData): StringNodeInput[] => {
  const config = getOperationConfig(data.operation);
  const currentInputs: NormalizedStringNodeInput[] = (data.stringInputs ?? []).map((input) => ({
    ...input,
    role: getInputRole(input)
  }));

  const textInputs = currentInputs.filter((input) => getInputRole(input) === 'text');
  const trimmed: NormalizedStringNodeInput[] = textInputs.slice(0, config.text.max).map((input) => ({ ...input }));

  while (trimmed.length < config.text.min) {
    const label = config.text.labels[trimmed.length] ?? `Text ${trimmed.length + 1}`;
    trimmed.push(createStringInput(label, 'text'));
  }

  const labeledTextInputs: NormalizedStringNodeInput[] = trimmed.map((input, index) => ({
    ...input,
    label: config.text.labels[index] ?? `Text ${index + 1}`,
    role: 'text'
  }));

  const staticInputs: NormalizedStringNodeInput[] = (config.staticInputs ?? []).map((entry) => {
    const existing = currentInputs.find((input) => getInputRole(input) === entry.role);
    const fallbackValue = existing?.sampleValue ?? getOptionsFallback(entry.role, data.options);
    if (existing) {
      return { ...existing, role: entry.role, label: entry.label, sampleValue: fallbackValue };
    }
    return createStringInput(entry.label, entry.role, fallbackValue);
  });

  return [...labeledTextInputs, ...staticInputs];
};

const areInputsEqual = (a: StringNodeInput[], b: StringNodeInput[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((input, index) => {
    const other = b[index];
    if (!other) {
      return false;
    }
    return (
      input.id === other.id &&
      input.label === other.label &&
      (input.sampleValue ?? '') === (other.sampleValue ?? '') &&
      getInputRole(input) === getInputRole(other)
    );
  });
};

const isNumericRole = (role: StringNodeInputRole): boolean => role === 'start' || role === 'end';

export const StringNode = ({ id, data }: NodeProps<StringNodeData>) => {
  const updateData = useNodeDataUpdater<StringNodeData>(id);
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const config = getOperationConfig(data.operation);
  const textInputs = data.stringInputs.filter((input) => getInputRole(input) === 'text');
  const canAddInput = textInputs.length < config.text.max;
  const minTextInputs = config.text.min;

  useEffect(() => {
    const normalized = enforceStringInputs(data);
    if (areInputsEqual(data.stringInputs, normalized)) {
      return;
    }
    updateData((prev) => {
      const nextInputs = enforceStringInputs(prev);
      if (areInputsEqual(prev.stringInputs, nextInputs)) {
        return prev;
      }
      logicLogger.info('String inputs normalized', {
        nodeId: id,
        operation: prev.operation,
        before: prev.stringInputs.length,
        after: nextInputs.length
      });
      return { ...prev, stringInputs: nextInputs };
    });
  }, [data, id, updateData]);

  const handleOperationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const operation = event.target.value as StringNodeData['operation'];
    logicLogger.info('String operation changed', { nodeId: id, operation });
    updateData((prev) => ({ ...prev, operation }));
  };

  const handleInputChange = (inputId: string, event: ChangeEvent<HTMLInputElement>) => {
    const sampleValue = event.target.value;
    const targetInput = data.stringInputs.find((input) => input.id === inputId);
    logicLogger.debug('String input sample updated', {
      nodeId: id,
      inputId,
      operation: data.operation,
      role: targetInput ? getInputRole(targetInput) : 'text',
      valueLength: sampleValue.length
    });
    updateData((prev) => ({
      ...prev,
      stringInputs: prev.stringInputs.map((input) => (input.id === inputId ? { ...input, sampleValue } : input))
    }));
  };

  const handleAddInput = () => {
    if (!canAddInput) {
      logicLogger.warn('String input add blocked: max reached', {
        nodeId: id,
        operation: data.operation,
        maxInputs: config.text.max
      });
      return;
    }
    const inputId = generateInputId();
    const label = config.text.labels[textInputs.length] ?? `Text ${textInputs.length + 1}`;
    logicLogger.info('String input added', { nodeId: id, inputId, operation: data.operation, label });
    updateData((prev) => ({
      ...prev,
      stringInputs: prev.stringInputs.concat({ id: inputId, label, role: 'text', sampleValue: '' })
    }));
  };

  const handleRemoveInput = (inputId: string) => {
    const targetInput = data.stringInputs.find((input) => input.id === inputId);
    if (!targetInput) {
      logicLogger.warn('Attempted to remove unknown string input', { nodeId: id, inputId, operation: data.operation });
      return;
    }
    if (getInputRole(targetInput) !== 'text') {
      logicLogger.warn('Attempted to remove non-text string input', {
        nodeId: id,
        inputId,
        operation: data.operation,
        role: targetInput.role
      });
      return;
    }
    if (textInputs.length <= minTextInputs) {
      logicLogger.warn('String input removal blocked: minimum reached', {
        nodeId: id,
        operation: data.operation,
        minInputs: minTextInputs
      });
      return;
    }
    logicLogger.warn('String input removed', { nodeId: id, inputId, operation: data.operation });
    updateData((prev) => ({
      ...prev,
      stringInputs: prev.stringInputs.filter((input) => input.id !== inputId)
    }));
  };

  const totalTextInputs = textInputs.length;

  return (
    <div className="relative">
      <NodeChrome badge="String" label={data.label} description={data.description ?? 'String utilities'} preview={preview}>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
          Operation
          <select
            className="bw-node-select mt-1 text-xs"
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
          {data.stringInputs.map((input, index) => {
            const handleId = `string-${input.id}`;
            const binding = previewResolver.getHandleBinding(id, handleId);
            const role = getInputRole(input);
            const isTextInput = role === 'text';
            const canRemove = isTextInput && totalTextInputs > minTextInputs;
            return (
              <div key={input.id} className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <Handle
                  type="target"
                  id={handleId}
                  position={Position.Left}
                  className="!left-[-6px] !h-3 !w-3 !bg-bw-platinum"
                />
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">
                <span>
                  {input.label}
                  <span className="ml-1 text-[10px] lowercase text-bw-platinum/40">#{index + 1}</span>
                </span>
                {canRemove && (
                  <button type="button" className="text-bw-sand" onClick={() => handleRemoveInput(input.id)}>
                    ×
                  </button>
                )}
              </div>
                {binding ? (
                  <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
                    <p className="text-white">{formatScalar(binding.value as ScalarValue)}</p>
                    <p className="text-[10px] text-bw-platinum/60">{binding.sourceLabel}</p>
                  </div>
                ) : (
                  <input
                    type={isNumericRole(role) ? 'number' : 'text'}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
                    value={input.sampleValue ?? ''}
                    onChange={(event) => handleInputChange(input.id, event)}
                  />
                )}
              </div>
            );
          })}
          {canAddInput && (
            <button
              type="button"
              className="w-full rounded-xl border border-dashed border-white/20 py-2 text-xs text-white/70"
              onClick={handleAddInput}
              disabled={!canAddInput}
              title={!canAddInput ? 'Maximum text inputs reached for this operation' : undefined}
            >
              Add input
            </button>
          )}
        </div>
      </NodeChrome>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-bw-sand" id={`string-${id}-out`} />
    </div>
  );
};
