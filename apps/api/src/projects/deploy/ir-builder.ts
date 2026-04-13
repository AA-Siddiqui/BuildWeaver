import { createEmptyProject } from '@buildweaver/libs';
import type {
  DummyNodeData,
  Page,
  PageNodeData,
  PageQueryConnection,
  ProjectGraphSnapshot,
  ProjectIR,
  QueryNodeData,
  ScalarValue,
} from '@buildweaver/libs';
import type { ProjectPage } from '@buildweaver/db';

const computePageQueryConnections = (
  graph: ProjectGraphSnapshot,
): PageQueryConnection[] => {
  const connections: PageQueryConnection[] = [];
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));

  for (const edge of graph.edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) {
      continue;
    }

    if (sourceNode.type === 'query' && targetNode.type === 'page') {
      const queryData = sourceNode.data as QueryNodeData;
      const pageData = targetNode.data as PageNodeData;
      const targetHandle = edge.targetHandle ?? '';
      const inputId = targetHandle.startsWith('input-')
        ? targetHandle.slice('input-'.length)
        : targetHandle;
      const matchingInput = pageData.inputs?.find(
        (input) => input.id === inputId || input.label === inputId,
      );

      connections.push({
        pageId: pageData.pageId,
        queryId: queryData.queryId,
        inputId,
        inputLabel: matchingInput?.label ?? inputId,
        queryMode: queryData.mode,
        schemaId: queryData.schemaId,
      });
      continue;
    }

    if (sourceNode.type === 'query' && targetNode.type !== 'page') {
      const queryData = sourceNode.data as QueryNodeData;
      for (const downstream of graph.edges) {
        if (downstream.source !== targetNode.id) {
          continue;
        }

        const downstreamTarget = nodeMap.get(downstream.target);
        if (!downstreamTarget || downstreamTarget.type !== 'page') {
          continue;
        }

        const pageData = downstreamTarget.data as PageNodeData;
        const targetHandle = downstream.targetHandle ?? '';
        const inputId = targetHandle.startsWith('input-')
          ? targetHandle.slice('input-'.length)
          : targetHandle;
        const matchingInput = pageData.inputs?.find(
          (input) => input.id === inputId || input.label === inputId,
        );
        const alreadyTracked = connections.some(
          (connection) =>
            connection.pageId === pageData.pageId &&
            connection.queryId === queryData.queryId &&
            connection.inputId === inputId,
        );

        if (!alreadyTracked) {
          connections.push({
            pageId: pageData.pageId,
            queryId: queryData.queryId,
            inputId,
            inputLabel: matchingInput?.label ?? inputId,
            queryMode: queryData.mode,
            schemaId: queryData.schemaId,
          });
        }
      }
    }
  }

  return connections;
};

const extractDummySampleValue = (sample: DummyNodeData['sample']): ScalarValue =>
  sample.value;

const computeDummyInputValues = (
  graph: ProjectGraphSnapshot,
): Map<string, ScalarValue> => {
  const values = new Map<string, ScalarValue>();
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));

  for (const edge of graph.edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode || sourceNode.type !== 'dummy') {
      continue;
    }

    const dummyData = sourceNode.data as DummyNodeData;
    if (!dummyData.sample) {
      continue;
    }

    if (targetNode.type === 'page') {
      const pageData = targetNode.data as PageNodeData;
      const targetHandle = edge.targetHandle ?? '';
      const inputId = targetHandle.startsWith('input-')
        ? targetHandle.slice('input-'.length)
        : targetHandle;
      const matchingInput = pageData.inputs?.find(
        (input) => input.id === inputId || input.label === inputId,
      );

      if (!matchingInput) {
        continue;
      }

      values.set(
        `${pageData.pageId}:${matchingInput.id}`,
        extractDummySampleValue(dummyData.sample),
      );
      continue;
    }

    for (const downstream of graph.edges) {
      if (downstream.source !== targetNode.id) {
        continue;
      }

      const downstreamTarget = nodeMap.get(downstream.target);
      if (!downstreamTarget || downstreamTarget.type !== 'page') {
        continue;
      }

      const pageData = downstreamTarget.data as PageNodeData;
      const targetHandle = downstream.targetHandle ?? '';
      const inputId = targetHandle.startsWith('input-')
        ? targetHandle.slice('input-'.length)
        : targetHandle;
      const matchingInput = pageData.inputs?.find(
        (input) => input.id === inputId || input.label === inputId,
      );
      if (!matchingInput) {
        continue;
      }

      const key = `${pageData.pageId}:${matchingInput.id}`;
      if (!values.has(key)) {
        values.set(key, extractDummySampleValue(dummyData.sample));
      }
    }
  }

  return values;
};

export const buildProjectIrForDeployment = (
  projectName: string,
  pages: ProjectPage[],
  graph?: ProjectGraphSnapshot,
): ProjectIR => {
  const project = createEmptyProject(projectName);

  project.pages = pages.map((page): Page => ({
    id: page.id,
    name: page.name,
    route: page.slug.startsWith('/') ? page.slug : `/${page.slug}`,
    entry: {
      id: 'stub-entry',
      key: 'stub',
      component: 'div',
      label: page.name,
      props: {},
      bindings: {},
      events: [],
      children: [],
    },
    builderState: page.builderState,
    dynamicInputs: page.dynamicInputs.map((input) => ({
      id: input.id,
      label: input.label,
      description: input.description,
      dataType: input.dataType,
      listItemType: input.listItemType,
      objectSample: input.objectSample,
    })),
  }));

  if (!graph) {
    return project;
  }

  project.databases = graph.databases ?? [];
  project.queries = graph.queries ?? [];
  project.userFunctions = graph.functions ?? [];
  project.pageQueryConnections = computePageQueryConnections(graph);

  const dummyValues = computeDummyInputValues(graph);
  if (dummyValues.size === 0) {
    return project;
  }

  for (const page of project.pages) {
    if (!page.dynamicInputs?.length) {
      continue;
    }

    for (const input of page.dynamicInputs) {
      const key = `${page.id}:${input.id}`;
      const sampleValue = dummyValues.get(key);
      if (typeof sampleValue !== 'undefined') {
        input.sampleValue = sampleValue;
      }
    }
  }

  return project;
};
