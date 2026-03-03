import type {
  BindingReference,
  ProjectIR,
  UITreeNode
} from '@buildweaver/libs';

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const sortObject = <T extends Record<string, unknown>>(input: T): T => {
  const sortedEntries = Object.entries(input).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const sorted: Record<string, unknown> = {};
  sortedEntries.forEach(([key, value]) => {
    sorted[key] = value;
  });
  return sorted as T;
};

const normalizeBindings = (
  bindings: Record<string, BindingReference>
): Record<string, BindingReference> => sortObject(bindings);

const normalizeUiNode = (node: UITreeNode): UITreeNode => ({
  ...node,
  props: sortObject(node.props),
  bindings: normalizeBindings(node.bindings),
  events: [...node.events].sort((a, b) => a.event.localeCompare(b.event)),
  children: [...node.children]
    .map((child) => normalizeUiNode(child))
    .sort((a, b) => a.key.localeCompare(b.key))
});

export const normalizeProject = (ir: ProjectIR): ProjectIR => {
  const project = deepClone(ir);

  project.assets = [...project.assets].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  project.dataSources = [...project.dataSources].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  project.dataModels = [...project.dataModels]
    .map((model) => ({
      ...model,
      fields: [...model.fields].sort((a, b) => a.name.localeCompare(b.name))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  project.pages = [...project.pages]
    .map((page) => ({
      ...page,
      entry: normalizeUiNode(page.entry),
      blocks: page.blocks
        ? [...page.blocks].sort((a, b) => a.order - b.order)
        : undefined
    }))
    .sort((a, b) => a.route.localeCompare(b.route));

  project.logic = {
    nodes: [...project.logic.nodes]
      .map((node) => ({
        ...node,
        inputs: [...node.inputs].sort((a, b) => a.name.localeCompare(b.name)),
        outputs: [...node.outputs].sort((a, b) => a.name.localeCompare(b.name))
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...project.logic.edges].sort((a, b) => a.id.localeCompare(b.id))
  };

  if (project.databases) {
    project.databases = [...project.databases]
      .map((db) => ({
        ...db,
        tables: [...db.tables]
          .map((t) => ({ ...t, fields: [...t.fields].sort((a, b) => a.name.localeCompare(b.name)) }))
          .sort((a, b) => a.name.localeCompare(b.name))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  if (project.queries) {
    project.queries = [...project.queries].sort((a, b) => a.name.localeCompare(b.name));
  }

  if (project.userFunctions) {
    project.userFunctions = [...project.userFunctions].sort((a, b) => a.name.localeCompare(b.name));
  }

  if (project.pageQueryConnections) {
    project.pageQueryConnections = [...project.pageQueryConnections].sort(
      (a, b) => a.pageId.localeCompare(b.pageId) || a.queryId.localeCompare(b.queryId)
    );
  }

  return project;
};
