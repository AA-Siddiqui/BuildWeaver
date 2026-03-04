import { createEmptyProject } from '@buildweaver/libs';
import type { ProjectIR, Page, PageQueryConnection, ScalarValue } from '@buildweaver/libs';
import type {
  PageDocument,
  ProjectGraphSnapshot,
  PageNodeData,
  QueryNodeData,
  DummyNodeData,
} from '../../types/api';
import { codegenLogger } from '../../lib/logger';

/**
 * Trace direct query->page connections from the graph edges.
 * Returns an array of PageQueryConnection describing what query feeds
 * which dynamic input on which page.
 */
const computePageQueryConnections = (
  graph: ProjectGraphSnapshot,
): PageQueryConnection[] => {
  const connections: PageQueryConnection[] = [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const edge of graph.edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) continue;

    // Direct: query -> page
    if (targetNode.type === 'page' && sourceNode.type === 'query') {
      const pageData = targetNode.data as PageNodeData;
      const queryData = sourceNode.data as QueryNodeData;
      const inputHandle = edge.targetHandle ?? '';
      const inputId = inputHandle.startsWith('input-')
        ? inputHandle.slice('input-'.length)
        : inputHandle;

      const matchingInput = pageData.inputs?.find(
        (inp) => inp.id === inputId || inp.label === inputId,
      );

      connections.push({
        pageId: pageData.pageId,
        queryId: queryData.queryId,
        inputId,
        inputLabel: matchingInput?.label ?? inputId,
        queryMode: queryData.mode,
        schemaId: queryData.schemaId,
      });

      codegenLogger.debug('Traced direct query->page connection', {
        queryName: queryData.queryName,
        pageName: pageData.pageName,
        inputLabel: matchingInput?.label ?? inputId,
        mode: queryData.mode,
      });
    }

    // Indirect: query -> [intermediate] -> page (one-hop)
    if (targetNode.type !== 'page' && sourceNode.type === 'query') {
      const queryData = sourceNode.data as QueryNodeData;

      for (const downstream of graph.edges) {
        if (downstream.source !== targetNode.id) continue;
        const downstreamTarget = nodeMap.get(downstream.target);
        if (!downstreamTarget || downstreamTarget.type !== 'page') continue;

        const pageData = downstreamTarget.data as PageNodeData;
        const inputHandle = downstream.targetHandle ?? '';
        const inputId = inputHandle.startsWith('input-')
          ? inputHandle.slice('input-'.length)
          : inputHandle;
        const matchingInput = pageData.inputs?.find(
          (inp) => inp.id === inputId || inp.label === inputId,
        );

        const duplicate = connections.some(
          (c) =>
            c.pageId === pageData.pageId &&
            c.queryId === queryData.queryId &&
            c.inputId === inputId,
        );
        if (duplicate) continue;

        connections.push({
          pageId: pageData.pageId,
          queryId: queryData.queryId,
          inputId,
          inputLabel: matchingInput?.label ?? inputId,
          queryMode: queryData.mode,
          schemaId: queryData.schemaId,
        });

        codegenLogger.debug('Traced indirect query->...->page connection', {
          queryName: queryData.queryName,
          intermediate: targetNode.type,
          pageName: pageData.pageName,
          inputLabel: matchingInput?.label ?? inputId,
        });
      }
    }
  }

  return connections;
};

/**
 * Extract the plain ScalarValue from a DummySampleValue wrapper.
 */
const extractDummySampleValue = (sample: DummyNodeData['sample']): ScalarValue => {
  return sample.value;
};

/**
 * Trace dummy->page connections from the graph edges.
 * Returns a Map keyed by "pageId:inputId" → ScalarValue from the dummy node.
 * Handles both direct (dummy->page) and indirect (dummy->intermediate->page)
 * connections.
 */
const computeDummyInputValues = (
  graph: ProjectGraphSnapshot,
): Map<string, ScalarValue> => {
  const values = new Map<string, ScalarValue>();
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const edge of graph.edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) continue;

    // Direct: dummy -> page
    if (sourceNode.type === 'dummy' && targetNode.type === 'page') {
      const dummyData = sourceNode.data as DummyNodeData;
      const pageData = targetNode.data as PageNodeData;
      const inputHandle = edge.targetHandle ?? '';
      const inputId = inputHandle.startsWith('input-')
        ? inputHandle.slice('input-'.length)
        : inputHandle;

      const matchingInput = pageData.inputs?.find(
        (inp) => inp.id === inputId || inp.label === inputId,
      );

      if (matchingInput && dummyData.sample) {
        const key = `${pageData.pageId}:${matchingInput.id}`;
        values.set(key, extractDummySampleValue(dummyData.sample));

        codegenLogger.debug('Traced direct dummy->page connection', {
          dummyLabel: dummyData.label,
          pageName: pageData.pageName,
          inputLabel: matchingInput.label,
          sampleType: dummyData.sample.type,
          sampleValue: dummyData.sample.value,
        });
      } else {
        codegenLogger.warn('Dummy->page edge could not be resolved', {
          dummyNodeId: sourceNode.id,
          pageNodeId: targetNode.id,
          inputHandle,
          hasSample: Boolean(dummyData.sample),
          matchedInput: Boolean(matchingInput),
          availableInputs: pageData.inputs?.map((i) => i.id) ?? [],
        });
      }
    }

    // Indirect: dummy -> [intermediate] -> page (one-hop)
    if (sourceNode.type === 'dummy' && targetNode.type !== 'page') {
      const dummyData = sourceNode.data as DummyNodeData;

      for (const downstream of graph.edges) {
        if (downstream.source !== targetNode.id) continue;
        const downstreamTarget = nodeMap.get(downstream.target);
        if (!downstreamTarget || downstreamTarget.type !== 'page') continue;

        const pageData = downstreamTarget.data as PageNodeData;
        const inputHandle = downstream.targetHandle ?? '';
        const inputId = inputHandle.startsWith('input-')
          ? inputHandle.slice('input-'.length)
          : inputHandle;

        const matchingInput = pageData.inputs?.find(
          (inp) => inp.id === inputId || inp.label === inputId,
        );

        if (!matchingInput || !dummyData.sample) continue;

        const key = `${pageData.pageId}:${matchingInput.id}`;
        if (values.has(key)) continue;

        values.set(key, extractDummySampleValue(dummyData.sample));

        codegenLogger.debug('Traced indirect dummy->...->page connection', {
          dummyLabel: dummyData.label,
          intermediate: targetNode.type,
          pageName: pageData.pageName,
          inputLabel: matchingInput.label,
          sampleType: dummyData.sample.type,
        });
      }
    }
  }

  codegenLogger.info('Dummy input values computed', {
    resolvedCount: values.size,
    keys: [...values.keys()],
  });

  return values;
};

export const buildProjectIR = (
  projectName: string,
  pages: PageDocument[],
  graph?: ProjectGraphSnapshot,
): ProjectIR => {
  codegenLogger.info('Building ProjectIR from page documents', {
    projectName,
    pageCount: pages.length,
    pageNames: pages.map((p) => p.name),
    hasGraph: Boolean(graph),
    databaseCount: graph?.databases?.length ?? 0,
    queryCount: graph?.queries?.length ?? 0,
  });

  const project = createEmptyProject(projectName);

  project.pages = pages.map((page): Page => {
    const route = page.slug.startsWith('/') ? page.slug : `/${page.slug}`;

    codegenLogger.debug(`Mapping page "${page.name}" -> route "${route}"`, {
      pageId: page.id,
      hasDynamicInputs: page.dynamicInputs.length > 0,
      hasBuilderState: Boolean(page.builderState && Object.keys(page.builderState).length > 0),
    });

    return {
      id: page.id,
      name: page.name,
      route,
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
    };
  });

  // Attach graph data when available
  if (graph) {
    project.databases = graph.databases ?? [];
    project.queries = graph.queries ?? [];
    project.userFunctions = graph.functions ?? [];

    codegenLogger.info('Graph data attached to IR', {
      databases: project.databases.length,
      queries: project.queries.length,
      functions: project.userFunctions.length,
    });

    project.pageQueryConnections = computePageQueryConnections(graph);
    codegenLogger.info('Page-query connections computed', {
      connections: project.pageQueryConnections.length,
    });

    // Resolve dummy node sample values and attach them to page dynamic inputs
    const dummyValues = computeDummyInputValues(graph);
    if (dummyValues.size > 0) {
      for (const page of project.pages) {
        if (!page.dynamicInputs?.length) continue;
        for (const input of page.dynamicInputs) {
          const key = `${page.id}:${input.id}`;
          const value = dummyValues.get(key);
          if (value !== undefined) {
            input.sampleValue = value;
            codegenLogger.debug('Attached dummy sample value to page input', {
              pageId: page.id,
              pageName: page.name,
              inputId: input.id,
              inputLabel: input.label,
              sampleValue: value,
            });
          }
        }
      }
    }
  }

  codegenLogger.info('ProjectIR built successfully', {
    pages: project.pages.length,
    version: project.version,
    databases: project.databases?.length ?? 0,
    queries: project.queries?.length ?? 0,
    connections: project.pageQueryConnections?.length ?? 0,
  });

  return project;
};
