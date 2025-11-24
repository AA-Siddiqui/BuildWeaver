import { ChangeEvent, useEffect } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { ArithmeticNodeData } from '@buildweaver/libs';
import { NodeChrome } from './NodeChrome';
import { useNodeDataUpdater } from './hooks/useNodeDataUpdater';
import { logicLogger } from '../../lib/logger';
import { usePreviewResolver } from './previewResolver';
import { formatScalar } from './preview';
import {
  getArithmeticOperationConfig,
  normalizeArithmeticOperands,
  operandsEqual
} from './arithmeticConfig';

const generateOperandId = () => `operand-${Math.random().toString(36).slice(2, 8)}`;

const createOperand = (operation: ArithmeticNodeData['operation'], index: number) => {
  const config = getArithmeticOperationConfig(operation);
  const label = config.labels[index] ?? `Input ${String.fromCharCode(65 + index)}`;
  return {
    id: generateOperandId(),
    label,
    sampleValue: 0
  };
};

export const ArithmeticNode = ({ id, data }: NodeProps<ArithmeticNodeData>) => {
  const updateData = useNodeDataUpdater<ArithmeticNodeData>(id);
  const previewResolver = usePreviewResolver();
  const preview = previewResolver.getNodePreview(id);
  const config = getArithmeticOperationConfig(data.operation);

  useEffect(() => {
    const normalized = normalizeArithmeticOperands(
      data.operands,
      config,
      (index) => createOperand(data.operation, index)
    );
    if (operandsEqual(data.operands, normalized)) {
      return;
    }
    updateData((prev) => {
      const prevConfig = getArithmeticOperationConfig(prev.operation);
      const nextOperands = normalizeArithmeticOperands(
        prev.operands,
        prevConfig,
        (index) => createOperand(prev.operation, index)
      );
      if (operandsEqual(prev.operands, nextOperands)) {
        return prev;
      }
      logicLogger.info('Arithmetic operands normalized', {
        nodeId: id,
        operation: prev.operation,
        before: prev.operands.length,
        after: nextOperands.length
      });
      return { ...prev, operands: nextOperands };
    });
  }, [config, data.operands, data.operation, id, updateData]);

  const handleOperationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const operation = event.target.value as ArithmeticNodeData['operation'];
    logicLogger.info('Arithmetic operation changed', { nodeId: id, operation });
    updateData((prev) => ({ ...prev, operation }));
  };

  const handleOperandSampleChange = (operandId: string, event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    logicLogger.debug('Arithmetic operand sample updated', { nodeId: id, operandId, value, operation: data.operation });
    updateData((prev) => ({
      ...prev,
      operands: prev.operands.map((operand) =>
        operand.id === operandId ? { ...operand, sampleValue: Number.isNaN(value) ? null : value } : operand
      )
    }));
  };

  const handleAddOperand = () => {
    if (data.operands.length >= config.maxOperands) {
      logicLogger.warn('Arithmetic operand add blocked', {
        nodeId: id,
        operation: data.operation,
        maxOperands: config.maxOperands
      });
      return;
    }
    updateData((prev) => {
      const operand = createOperand(prev.operation, prev.operands.length);
      logicLogger.info('Arithmetic operand added', {
        nodeId: id,
        operandId: operand.id,
        operation: prev.operation
      });
      return {
        ...prev,
        operands: prev.operands.concat(operand)
      };
    });
  };

  const handleRemoveOperand = (operandId: string) => {
    if (data.operands.length <= config.minOperands) {
      logicLogger.warn('Arithmetic operand removal blocked', {
        nodeId: id,
        operandId,
        operation: data.operation,
        minOperands: config.minOperands
      });
      return;
    }
    logicLogger.warn('Arithmetic operand removed', { nodeId: id, operandId });
    updateData((prev) => ({
      ...prev,
      operands: prev.operands.filter((operand) => operand.id !== operandId)
    }));
  };

  const handlePrecisionChange = (event: ChangeEvent<HTMLInputElement>) => {
    const precision = Math.max(0, Math.min(5, Number(event.target.value) || 0));
    logicLogger.debug('Arithmetic precision updated', { nodeId: id, precision, operation: data.operation });
    updateData((prev) => ({ ...prev, precision }));
  };

  return (
    <div className="relative">
      <NodeChrome badge="Math" label={data.label} description={data.description ?? 'Arithmetic functions'} preview={preview}>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
          Operation
          <select
            className="bw-node-select mt-1 text-xs"
            value={data.operation}
            onChange={handleOperationChange}
          >
            <option value="add">Add</option>
            <option value="subtract">Subtract</option>
            <option value="multiply">Multiply</option>
            <option value="divide">Divide</option>
            <option value="modulo">Modulo</option>
            <option value="average">Average</option>
            <option value="min">Min</option>
            <option value="max">Max</option>
          </select>
        </label>
        <div className="space-y-2">
          {data.operands.map((operand, index) => {
            const handleId = `operand-${operand.id}`;
            const binding = previewResolver.getHandleBinding(id, handleId);
            return (
              <div key={operand.id} className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <Handle
                  type="target"
                  id={handleId}
                  position={Position.Left}
                  className="!left-[-6px] !h-3 !w-3 !bg-bw-platinum"
                />
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-bw-platinum/60">
                <span>
                  {operand.label}
                  <span className="ml-1 text-[10px] lowercase text-bw-platinum/40">#{index + 1}</span>
                </span>
                {data.operands.length > config.minOperands && (
                  <button type="button" className="text-bw-sand" onClick={() => handleRemoveOperand(operand.id)}>
                    ×
                  </button>
                )}
              </div>
                {binding ? (
                  <div className="mt-1 rounded-lg border border-white/10 bg-bw-ink/50 px-2 py-1 text-xs text-bw-platinum">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Connected</p>
                    <p className="text-white">{formatScalar(binding.value as number)}</p>
                    <p className="text-[10px] text-bw-platinum/60">{binding.sourceLabel}</p>
                  </div>
                ) : (
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink/60 px-2 py-1 text-sm text-white"
                    value={operand.sampleValue ?? ''}
                    onChange={(event) => handleOperandSampleChange(operand.id, event)}
                  />
                )}
              </div>
            );
          })}
          {(data.operands.length < config.maxOperands) && (
            <button
              type="button"
              className="w-full rounded-xl border border-dashed border-white/20 py-2 text-xs text-white/70"
              onClick={handleAddOperand}
              disabled={data.operands.length >= config.maxOperands}
            >
              Add operand
            </button>
          )}
        </div>
        <label className="flex flex-col text-[11px] uppercase tracking-[0.2em] text-bw-platinum/80">
          Precision
          <input
            type="number"
            min={0}
            max={5}
            className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
            value={data.precision}
            onChange={handlePrecisionChange}
          />
        </label>
      </NodeChrome>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-bw-sand" id={`arithmetic-${id}-out`} />
    </div>
  );
};
