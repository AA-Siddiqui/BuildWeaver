import type { ProjectComponentDocument } from '@buildweaver/libs';
import type { BindingOption } from './dynamic-binding';
import { createPageBuilderConfig } from './builder-config';
import * as componentLibrary from './component-library';
import { createDynamicBindingState } from './dynamic-binding';

describe('builder-config library parameters', () => {
  const bindingOptions: BindingOption[] = [{ label: 'Title', value: 'title' }];

  const component: ProjectComponentDocument = {
    id: 'component-1',
    projectId: 'project-123',
    name: 'Hero component',
    slug: 'hero-component',
    definition: {
      type: 'Heading',
      props: {
        id: 'hero-1',
        content: createDynamicBindingState('title', '')
      }
    },
    bindingReferences: [
      {
        bindingId: 'title',
        componentId: 'hero-1',
        exposeAsParameter: true
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  it('creates parameter fields for library components', () => {
    const config = createPageBuilderConfig({ bindingOptions, resolveBinding: () => '' });
    const withLibrary = createPageBuilderConfig({
      bindingOptions,
      resolveBinding: () => '',
      componentLibrary: [component]
    });

    const baseKeys = Object.keys(config.components);
    const libraryComponent = withLibrary.components['Library:hero-component'];
    const signature = componentLibrary.buildBindingSignature(component.bindingReferences![0]!);

    const paramOverrides = (libraryComponent.defaultProps as { paramOverrides: Record<string, unknown> }).paramOverrides;

    expect(baseKeys).not.toContain('Library:hero-component');
    expect(libraryComponent.fields).toHaveProperty(signature);
    expect(paramOverrides).toHaveProperty(signature);
  });

  it('passes parameter field values into overrides before rendering', () => {
    const mergeSpy = jest.spyOn(componentLibrary, 'mergeParameterOverrides');
    const applySpy = jest.spyOn(componentLibrary, 'applyParameterOverrides');

    const withLibrary = createPageBuilderConfig({
      bindingOptions,
      resolveBinding: () => '',
      componentLibrary: [component]
    });

    const libraryComponent = withLibrary.components['Library:hero-component'];
    const signature = componentLibrary.buildBindingSignature(component.bindingReferences![0]!);
    const overrideValue = createDynamicBindingState('article.title', '');

    libraryComponent.render?.({
      id: 'instance-1',
      definitionId: component.id,
      definition: component.definition,
      name: component.name,
      paramOverrides: {},
      [signature]: overrideValue
    } as never);

    expect(mergeSpy).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ bindingId: 'title' })]),
      expect.objectContaining({ [signature]: overrideValue }),
      {},
      expect.any(Function)
    );
    expect(applySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ [signature]: overrideValue }),
      expect.arrayContaining([expect.objectContaining({ bindingId: 'title' })])
    );

    mergeSpy.mockRestore();
    applySpy.mockRestore();
  });
});
