import { ObjectOperation } from '@buildweaver/libs';

export type ObjectInputRole = 'source' | 'patch' | 'keys' | 'key' | 'value';

export type ObjectInputKind = 'object' | 'keys' | 'key' | 'value';

export interface ObjectInputDefinition {
  role: ObjectInputRole;
  label: string;
  description: string;
  handleSuffix: string;
  kind: ObjectInputKind;
}

const INPUT_DEFINITIONS: Record<ObjectInputRole, ObjectInputDefinition> = {
  source: {
    role: 'source',
    label: 'Source object',
    description: 'Primary object to inspect or modify',
    handleSuffix: 'source',
    kind: 'object'
  },
  patch: {
    role: 'patch',
    label: 'Patch object',
    description: 'Fields merged into the source',
    handleSuffix: 'patch',
    kind: 'object'
  },
  keys: {
    role: 'keys',
    label: 'Keys list',
    description: 'List of keys to pick',
    handleSuffix: 'keys',
    kind: 'keys'
  },
  key: {
    role: 'key',
    label: 'Key path',
    description: 'Dot-delimited path',
    handleSuffix: 'key',
    kind: 'key'
  },
  value: {
    role: 'value',
    label: 'Value input',
    description: 'Value to assign',
    handleSuffix: 'value',
    kind: 'value'
  }
};

const OPERATION_INPUTS: Record<ObjectOperation, ObjectInputRole[]> = {
  merge: ['source', 'patch'],
  pick: ['source', 'keys'],
  set: ['source', 'key', 'value'],
  get: ['source', 'key'],
  keys: ['source'],
  values: ['source']
};

const DEFAULT_INPUTS: ObjectInputRole[] = ['source'];

export const getObjectOperationInputs = (operation: ObjectOperation): ObjectInputDefinition[] => {
  const roles = OPERATION_INPUTS[operation] ?? DEFAULT_INPUTS;
  return roles.map((role) => INPUT_DEFINITIONS[role]);
};

export const getObjectHandleId = (nodeId: string, role: ObjectInputRole): string => {
  const definition = INPUT_DEFINITIONS[role];
  return `object-${nodeId}-${definition.handleSuffix}`;
};
