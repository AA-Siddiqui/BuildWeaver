export type IRNode = {
  id: string;
  type: string;
};

export type ProjectIR = {
  id: string;
  name: string;
  nodes: IRNode[];
};

export const createEmptyProject = (name: string): ProjectIR => ({
  id: 'project-placeholder',
  name,
  nodes: []
});
