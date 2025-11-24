import { ListNodeData } from '@buildweaver/libs';

export type ListInputRole = 'primary' | 'secondary' | 'start' | 'end' | 'order';

type ListInputKind = 'list' | 'number' | 'order';

export interface ListInputDefinition {
  role: ListInputRole;
  label: string;
  handleSuffix: string;
  kind: ListInputKind;
}

const INPUT_DEFINITIONS: Record<ListInputRole, ListInputDefinition> = {
  primary: { role: 'primary', label: 'List input', handleSuffix: 'primary', kind: 'list' },
  secondary: { role: 'secondary', label: 'Additional input', handleSuffix: 'secondary', kind: 'list' },
  start: { role: 'start', label: 'Start index', handleSuffix: 'start', kind: 'number' },
  end: { role: 'end', label: 'End index', handleSuffix: 'end', kind: 'number' },
  order: { role: 'order', label: 'Sort order', handleSuffix: 'order', kind: 'order' }
};

const LIST_OPERATION_INPUTS: Record<ListNodeData['operation'], ListInputRole[]> = {
  append: ['primary', 'secondary'],
  merge: ['primary', 'secondary'],
  slice: ['primary', 'start', 'end'],
  unique: ['primary'],
  length: ['primary'],
  sort: ['primary', 'order']
};

const DEFAULT_ROLES: ListInputRole[] = ['primary'];

export const getListOperationInputs = (operation: ListNodeData['operation']): ListInputDefinition[] => {
  const roles = LIST_OPERATION_INPUTS[operation] ?? DEFAULT_ROLES;
  return roles.map((role) => INPUT_DEFINITIONS[role]);
};

export const getListHandleId = (nodeId: string, role: ListInputRole): string => {
  const definition = INPUT_DEFINITIONS[role];
  return `list-${nodeId}-${definition.handleSuffix}`;
};

export const normalizeSortOrderValue = (value: unknown): 'asc' | 'desc' | null => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'asc' || normalized === 'ascending') {
      return 'asc';
    }
    if (normalized === 'desc' || normalized === 'descending') {
      return 'desc';
    }
  }
  if (typeof value === 'number') {
    if (value > 0) {
      return 'asc';
    }
    if (value < 0) {
      return 'desc';
    }
  }
  if (typeof value === 'boolean') {
    return value ? 'asc' : 'desc';
  }
  return null;
};
