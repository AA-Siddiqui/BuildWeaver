import { createEmptyProject } from '@buildweaver/libs';
import type { ProjectIR, Page } from '@buildweaver/libs';
import type { PageDocument } from '../../types/api';
import { codegenLogger } from '../../lib/logger';

export const buildProjectIR = (projectName: string, pages: PageDocument[]): ProjectIR => {
  codegenLogger.info('Building ProjectIR from page documents', {
    projectName,
    pageCount: pages.length,
    pageNames: pages.map((p) => p.name)
  });

  const project = createEmptyProject(projectName);

  project.pages = pages.map((page): Page => {
    const route = page.slug.startsWith('/') ? page.slug : `/${page.slug}`;

    codegenLogger.debug(`Mapping page "${page.name}" -> route "${route}"`, {
      pageId: page.id,
      hasDynamicInputs: page.dynamicInputs.length > 0,
      hasBuilderState: Boolean(page.builderState && Object.keys(page.builderState).length > 0)
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
        children: []
      },
      builderState: page.builderState,
      dynamicInputs: page.dynamicInputs.map((input) => ({
        id: input.id,
        label: input.label,
        description: input.description,
        dataType: input.dataType,
        listItemType: input.listItemType,
        objectSample: input.objectSample
      }))
    };
  });

  codegenLogger.info('ProjectIR built successfully', {
    pages: project.pages.length,
    version: project.version
  });

  return project;
};
