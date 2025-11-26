export type ConditionalInputRole = 'condition' | 'truthy' | 'falsy';

export interface ConditionalInputDefinition {
  role: ConditionalInputRole;
  label: string;
  description: string;
  handleSuffix: string;
}

const INPUT_DEFINITIONS: Record<ConditionalInputRole, ConditionalInputDefinition> = {
  condition: {
    role: 'condition',
    label: 'Condition',
    description: 'Boolean input used to choose the branch',
    handleSuffix: 'condition'
  },
  truthy: {
    role: 'truthy',
    label: 'Value if true',
    description: 'Output when the condition evaluates to true',
    handleSuffix: 'truthy'
  },
  falsy: {
    role: 'falsy',
    label: 'Value if false',
    description: 'Output when the condition evaluates to false',
    handleSuffix: 'falsy'
  }
};

export const getConditionalInputDefinitions = (): ConditionalInputDefinition[] => Object.values(INPUT_DEFINITIONS);

export const getConditionalHandleId = (nodeId: string, role: ConditionalInputRole): string => {
  const definition = INPUT_DEFINITIONS[role];
  return `conditional-${nodeId}-${definition.handleSuffix}`;
};
