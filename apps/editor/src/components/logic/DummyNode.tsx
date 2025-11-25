import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { DummyNodeData, DummySampleValue, ScalarValue } from '@buildweaver/libs';
import { NodeChrome } from './NodeChrome';
import { useNodeDataUpdater } from './hooks/useNodeDataUpdater';
import { useCursorRestorer } from './hooks/useCursorRestorer';
import { useTextDraft } from './hooks/useTextDraft';
import { logicLogger } from '../../lib/logger';
import { parseScalarList, stringifyScalarList } from './valueParsers';
import { usePreviewResolver } from './previewResolver';
import { ObjectAttributesEditor } from './ObjectAttributesEditor';

const DEFAULT_SAMPLES: Record<DummySampleValue['type'], DummySampleValue> = {
  integer: { type: 'integer', value: 42 },
  decimal: { type: 'decimal', value: 3.14, precision: 2 },
  string: { type: 'string', value: 'Hello world' },
  boolean: { type: 'boolean', value: true },
  list: { type: 'list', value: [1, 2, 3] },
  object: { type: 'object', value: { status: 'ok', retries: 1 } }
};

export const DummyNode = ({ id, data }: NodeProps<DummyNodeData>) => {
  const updateData = useNodeDataUpdater<DummyNodeData>(id);
  const restoreCursor = useCursorRestorer();
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const listSampleString = data.sample.type === 'list'
    ? stringifyScalarList((data.sample.value as ScalarValue[]) ?? [])
    : '';
  const [listDraft, setListDraft] = useTextDraft(listSampleString, {
    nodeId: id,
    field: 'dummy.listSample'
  });

  const handleSampleChange = (sample: DummySampleValue) => {
    updateData((prev) => ({ ...prev, sample }));
  };

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextType = event.target.value as DummySampleValue['type'];
    logicLogger.info('Dummy node sample type changed', { nodeId: id, nextType });
    handleSampleChange(DEFAULT_SAMPLES[nextType]);
  };

  const handleValueChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const raw = event.target.value;
    const nextSample = { ...data.sample } as DummySampleValue;

    switch (data.sample.type) {
      case 'integer':
        nextSample.value = parseInt(raw, 10) || 0;
        break;
      case 'decimal':
        nextSample.value = Number(raw);
        break;
      case 'string':
        nextSample.value = raw;
        break;
      case 'boolean':
        nextSample.value = raw === 'true';
        break;
      case 'list':
        nextSample.value = parseScalarList(raw);
        break;
      default:
        break;
    }

    logicLogger.debug('Dummy sample updated', {
      nodeId: id,
      type: nextSample.type,
      rawLength: raw.length
    });
    handleSampleChange(nextSample);
    restoreCursor(event.target, { nodeId: id, field: nextSample.type });
  };

  const handleObjectSampleChange = (value: Record<string, ScalarValue>) => {
    logicLogger.debug('Dummy object sample updated', { nodeId: id, keys: Object.keys(value).length });
    handleSampleChange({ type: 'object', value });
  };

  const renderValueInput = () => {
    const commonProps = {
      className:
        'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white shadow-inner focus:border-bw-sand focus:outline-none',
      onChange: handleValueChange
    };

    switch (data.sample.type) {
      case 'integer':
      case 'decimal':
        return (
          <input
            type="number"
            step={data.sample.type === 'decimal' ? '0.01' : '1'}
            value={Number(data.sample.value ?? 0)}
            {...commonProps}
          />
        );
      case 'string':
        return <input type="text" value={String(data.sample.value ?? '')} {...commonProps} />;
      case 'boolean':
        return (
          <select
            value={String(data.sample.value ?? true)}
            className="bw-node-select mt-1 text-sm"
            onChange={handleValueChange}
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      case 'list':
        return (
          <textarea
            rows={3}
            value={listDraft}
            onChange={(event) => {
              setListDraft(event.target.value);
              handleValueChange(event);
            }}
            className={commonProps.className}
          />
        );
      case 'object':
        return (
          <div className="mt-2">
            <ObjectAttributesEditor
              nodeId={id}
              fieldKey="dummy.sample.object"
              value={(data.sample.value as Record<string, ScalarValue>) ?? {}}
              onChange={handleObjectSampleChange}
              emptyHint="Add attributes for this sample"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      <NodeChrome badge="Dummy" label={data.label} description="Static reference" preview={preview}>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
          Value kind
          <select
            className="bw-node-select mt-1 text-xs"
            value={data.sample.type}
            onChange={handleTypeChange}
          >
            <option value="integer">Integer</option>
            <option value="decimal">Decimal</option>
            <option value="string">String</option>
            <option value="boolean">Boolean</option>
            <option value="list">List</option>
            <option value="object">Object</option>
          </select>
        </label>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
          Sample value
          {renderValueInput()}
        </label>
      </NodeChrome>
      <Handle
        id="dummy-output"
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !bg-bw-sand"
      />
    </div>
  );
};
