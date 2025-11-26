import { LogicalOperatorNodeData } from '@buildweaver/libs';

export type LogicalInputRole = 'primary' | 'secondary';

export interface LogicalOperationConfig {
  label: string;
  description: string;
  roles: LogicalInputRole[];
}

const LOGICAL_OPERATION_CONFIG: Record<LogicalOperatorNodeData['operation'], LogicalOperationConfig> = {
  and: {
    label: 'AND',
    description: 'Outputs true when both inputs are true',
    roles: ['primary', 'secondary']
  },
  or: {
    label: 'OR',
    description: 'Outputs true when either input is true',
    roles: ['primary', 'secondary']
  },
  not: {
    label: 'NOT',
    description: 'Outputs the inverse of the single input',
    roles: ['primary']
  }
};

const FALLBACK_OPERATION: LogicalOperationConfig = LOGICAL_OPERATION_CONFIG.and;

export const getLogicalOperationConfig = (
  operation: LogicalOperatorNodeData['operation']
): LogicalOperationConfig => LOGICAL_OPERATION_CONFIG[operation] ?? FALLBACK_OPERATION;

export const getLogicalHandleId = (nodeId: string, role: LogicalInputRole): string =>
  `logical-${nodeId}-${role}`;

export const getLogicalInputLabel = (role: LogicalInputRole): string =>
  role === 'primary' ? 'Input A' : 'Input B';
