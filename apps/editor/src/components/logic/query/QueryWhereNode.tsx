import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import type { QueryWhereNodeData, SqlOperator } from '@buildweaver/libs';
import { NodeChrome } from '../NodeChrome';
import { useNodeDataUpdater } from '../hooks/useNodeDataUpdater';
import { useCursorRestorer } from '../hooks/useCursorRestorer';
import { usePreviewResolver } from '../previewResolver';
import { useQuerySchema } from './QuerySchemaContext';
import { logicLogger } from '../../../lib/logger';

const LOGGER_PREFIX = 'QueryWhereNode';

const SQL_OPERATORS: { value: SqlOperator; label: string }[] = [
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: 'in', label: 'IN' },
  { value: 'not in', label: 'NOT IN' },
  { value: 'like', label: 'LIKE' },
  { value: 'not like', label: 'NOT LIKE' },
  { value: 'is null', label: 'IS NULL' },
  { value: 'is not null', label: 'IS NOT NULL' }
];

export const QueryWhereNode = ({ id, data }: NodeProps<QueryWhereNodeData>) => {
  const updateData = useNodeDataUpdater<QueryWhereNodeData>(id);
  const restoreCursor = useCursorRestorer();
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const { tables } = useQuerySchema();

  const bindingData = previewResolver.getHandleBinding(id, 'input-data');
  const bindingCondition = previewResolver.getHandleBinding(id, 'input-condition');

  const allFields = tables.flatMap(t => t.fields.map(f => `${t.name}.${f.name}`));

  const handleOperatorChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const operator = event.target.value as SqlOperator;
    logicLogger.info(`[${LOGGER_PREFIX}] operator changed`, { nodeId: id, operator });
    updateData((prev) => ({ ...prev, operator }));
  };

  const handleLeftOperandChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const leftOperand = event.target.value;
    logicLogger.debug(`[${LOGGER_PREFIX}] left operand changed`, { nodeId: id, leftOperand });
    updateData((prev) => ({ ...prev, leftOperand }));
    if (event.target instanceof HTMLInputElement) {
      restoreCursor(event.target, { nodeId: id, field: 'leftOperand' });
    }
  };

  const handleRightOperandChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const rightOperand = event.target.value;
    logicLogger.debug(`[${LOGGER_PREFIX}] right operand changed`, { nodeId: id, rightOperand });
    updateData((prev) => ({ ...prev, rightOperand }));
    if (event.target instanceof HTMLInputElement) {
      restoreCursor(event.target, { nodeId: id, field: 'rightOperand' });
    }
  };

  const handleLeftIsColumnToggle = () => {
    logicLogger.debug(`[${LOGGER_PREFIX}] left isColumn toggled`, { nodeId: id, leftIsColumn: !data.leftIsColumn });
    updateData((prev) => ({ ...prev, leftIsColumn: !prev.leftIsColumn, leftOperand: '' }));
  };

  const handleRightIsColumnToggle = () => {
    logicLogger.debug(`[${LOGGER_PREFIX}] right isColumn toggled`, { nodeId: id, rightIsColumn: !data.rightIsColumn });
    updateData((prev) => ({ ...prev, rightIsColumn: !prev.rightIsColumn, rightOperand: '' }));
  };

  const isUnary = data.operator === 'is null' || data.operator === 'is not null';

  return (
    <div className="relative">
      <NodeChrome badge="WHERE" label="Where" description="SQL WHERE filter" preview={preview}>
        {/* Data input */}
        <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Handle
            type="target"
            id="input-data"
            position={Position.Left}
            className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
            style={{ top: '20%' }}
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Data input</p>
          {bindingData && (
            <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
              <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
              <p className="text-[10px] text-bw-platinum/60">{bindingData.sourceLabel}</p>
            </div>
          )}
        </div>

        {/* Condition input */}
        <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Handle
            type="target"
            id="input-condition"
            position={Position.Left}
            className="!left-[-6px] !h-3 !w-3 !rounded-full !bg-[#D34E4E]"
            style={{ top: '80%' }}
          />
          <p className="text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">Condition</p>
          {bindingCondition ? (
            <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
              <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
              <p className="text-[10px] text-bw-platinum/60">{bindingCondition.sourceLabel}</p>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {/* Left operand */}
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-bw-platinum/50">Left operand</p>
                  <button
                    type="button"
                    className="text-[10px] text-bw-sand underline"
                    onClick={handleLeftIsColumnToggle}
                  >
                    {data.leftIsColumn ? 'Column' : 'Value'}
                  </button>
                </div>
                {data.leftIsColumn ? (
                  <select
                    className="bw-node-select mt-1 text-xs"
                    value={data.leftOperand ?? ''}
                    onChange={handleLeftOperandChange}
                  >
                    <option value="">-- Select column --</option>
                    {allFields.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
                    value={data.leftOperand ?? ''}
                    onChange={handleLeftOperandChange}
                    placeholder="Value"
                  />
                )}
              </div>

              {/* Operator */}
              <select
                className="bw-node-select text-xs"
                value={data.operator}
                onChange={handleOperatorChange}
              >
                {SQL_OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>

              {/* Right operand (hidden for unary) */}
              {!isUnary && (
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-bw-platinum/50">Right operand</p>
                    <button
                      type="button"
                      className="text-[10px] text-bw-sand underline"
                      onClick={handleRightIsColumnToggle}
                    >
                      {data.rightIsColumn ? 'Column' : 'Value'}
                    </button>
                  </div>
                  {data.rightIsColumn ? (
                    <select
                      className="bw-node-select mt-1 text-xs"
                      value={data.rightOperand ?? ''}
                      onChange={handleRightOperandChange}
                    >
                      <option value="">-- Select column --</option>
                      {allFields.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
                      value={data.rightOperand ?? ''}
                      onChange={handleRightOperandChange}
                      placeholder="Value"
                    />
                  )}
                </div>
              )}
            </div>
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
