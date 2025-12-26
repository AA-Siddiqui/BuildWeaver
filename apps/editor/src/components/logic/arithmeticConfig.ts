import { ArithmeticNodeData, ArithmeticOperand } from '@buildweaver/libs';

export interface ArithmeticOperationConfig {
  minOperands: number;
  maxOperands: number;
  labels: string[];
}

const DEFAULT_LABELS = ['Input A', 'Input B', 'Input C', 'Input D'];

const DEFAULT_CONFIG: ArithmeticOperationConfig = {
  minOperands: 2,
  maxOperands: 4,
  labels: DEFAULT_LABELS
};

const ARITHMETIC_OPERATION_CONFIG: Record<ArithmeticNodeData['operation'], ArithmeticOperationConfig> = {
  add: DEFAULT_CONFIG,
  subtract: DEFAULT_CONFIG,
  multiply: DEFAULT_CONFIG,
  divide: DEFAULT_CONFIG,
  average: DEFAULT_CONFIG,
  min: DEFAULT_CONFIG,
  max: DEFAULT_CONFIG,
  exponent: {
    minOperands: 2,
    maxOperands: 2,
    labels: ['Base', 'Exponent']
  },
  modulo: {
    minOperands: 2,
    maxOperands: 2,
    labels: ['Dividend', 'Divisor']
  }
};

export const getArithmeticOperationConfig = (
  operation: ArithmeticNodeData['operation']
): ArithmeticOperationConfig => {
  return ARITHMETIC_OPERATION_CONFIG[operation] ?? DEFAULT_CONFIG;
};

const buildOperandLabel = (index: number, labels: string[]): string => {
  if (labels[index]) {
    return labels[index];
  }
  if (index < DEFAULT_LABELS.length) {
    return DEFAULT_LABELS[index];
  }
  return `Input ${index + 1}`;
};

export const normalizeArithmeticOperands = (
  operands: ArithmeticOperand[],
  config: ArithmeticOperationConfig,
  createOperand: (index: number) => ArithmeticOperand
): ArithmeticOperand[] => {
  const trimmed = operands
    .slice(0, config.maxOperands)
    .map((operand, index) => ({ ...operand, label: buildOperandLabel(index, config.labels) }));

  const next: ArithmeticOperand[] = [...trimmed];
  while (next.length < config.minOperands) {
    const index = next.length;
    const operand = createOperand(index);
    next.push({ ...operand, label: buildOperandLabel(index, config.labels) });
  }
  return next;
};

export const operandsEqual = (a: ArithmeticOperand[], b: ArithmeticOperand[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((operand, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      operand.id === other.id &&
      operand.label === other.label &&
      operand.sampleValue === other.sampleValue
    );
  });
};
