import { RelationalOperatorNodeData } from '@buildweaver/libs';

export type RelationalInputRole = 'left' | 'right';

export interface RelationalOperationConfig {
  label: string;
  symbol: string;
  description: string;
}

const RELATIONAL_OPERATION_CONFIG: Record<RelationalOperatorNodeData['operation'], RelationalOperationConfig> = {
  gt: { label: 'Greater Than', symbol: '>', description: 'Returns true when left is greater than right' },
  gte: { label: 'Greater Than or Equal', symbol: '>=', description: 'True when left is greater than or equal to right' },
  lt: { label: 'Less Than', symbol: '<', description: 'True when left is less than right' },
  lte: { label: 'Less Than or Equal', symbol: '<=', description: 'True when left is less than or equal to right' },
  eq: { label: 'Equals', symbol: '=', description: 'True when both operands are equal' },
  neq: { label: 'Not Equals', symbol: '!=', description: 'True when operands differ' }
};

const FALLBACK_OPERATION: RelationalOperationConfig = RELATIONAL_OPERATION_CONFIG.eq;

export const getRelationalOperationConfig = (
  operation: RelationalOperatorNodeData['operation']
): RelationalOperationConfig => RELATIONAL_OPERATION_CONFIG[operation] ?? FALLBACK_OPERATION;

export const getRelationalHandleId = (nodeId: string, role: RelationalInputRole): string =>
  `relational-${nodeId}-${role}`;

export const getRelationalInputLabel = (role: RelationalInputRole): string =>
  role === 'left' ? 'Left operand' : 'Right operand';
