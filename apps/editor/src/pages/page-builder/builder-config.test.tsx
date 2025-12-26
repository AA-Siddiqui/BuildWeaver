import { render, screen } from '@testing-library/react';
import type { ScalarValue } from '@buildweaver/libs';
import { createDynamicBindingState, resolvePropertyPathValue } from './dynamic-binding';
import { createPageBuilderConfig, mergeSectionBackgrounds } from './builder-config';
import { STYLELESS_STYLE_DEFAULTS, type StyleFieldKey } from './style-controls';
import {
  LIST_SCOPE_BINDING_PREFIX,
  projectListSlotPropertyPath,
  resolveListSlotScopedValue,
  useListSlotContext
} from './list-slot-context';

describe('mergeSectionBackgrounds', () => {
  const gradient = 'linear-gradient(45deg, #111827 0%, #F9E7B2 100%)';
  const backgroundUrl = 'https://cdn.example.com/background.png';
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

  it('preserves gradient-only backgrounds when no image is provided', () => {
    const merged = mergeSectionBackgrounds({ backgroundImage: gradient }, undefined, 'section-gradient');
    expect(merged.backgroundImage).toBe(gradient);
    expect(merged.backgroundSize).toBeUndefined();
    expect(merged.backgroundPosition).toBeUndefined();
  });

  it('layers gradients above background images with sensible sizing', () => {
    const merged = mergeSectionBackgrounds({ backgroundImage: gradient }, backgroundUrl, 'section-layered');
    expect(merged.backgroundImage).toBe(`${gradient}, url(${backgroundUrl})`);
    expect(merged.backgroundSize).toBe('auto, cover');
    expect(merged.backgroundPosition).toBe('0% 0%, center');
  });

  it('applies image-only backgrounds when no gradient is present', () => {
    const merged = mergeSectionBackgrounds({}, backgroundUrl, 'section-image');
    expect(merged.backgroundImage).toBe(`url(${backgroundUrl})`);
    expect(merged.backgroundSize).toBe('cover');
    expect(merged.backgroundPosition).toBe('center');
  });
});

describe('styleless default propagation', () => {
  it('applies zeroed css defaults to every registered component', () => {
    const config = createPageBuilderConfig({
      bindingOptions: [],
      resolveBinding: (text) => text ?? ''
    });
    const components = config.components ?? {};
    const styleEntries = Object.entries(STYLELESS_STYLE_DEFAULTS) as Array<[
      StyleFieldKey,
      (typeof STYLELESS_STYLE_DEFAULTS)[StyleFieldKey]
    ]>;
    Object.entries(components).forEach(([, component]) => {
      const defaults = (component.defaultProps ?? {}) as Record<string, unknown>;
      styleEntries.forEach(([styleKey, expectedValue]) => {
        expect(defaults[styleKey]).toBe(
          expectedValue
        );
      });
      expect(component.defaultProps).toBeDefined();
    });
  });
});

describe('Heading component rendering', () => {
  it('respects fully transparent background colors inside sections', () => {
    const config = createPageBuilderConfig({
      bindingOptions: [],
      resolveBinding: (text) => text ?? ''
    });
    const heading = config.components?.Heading;
    if (!heading?.render) {
      throw new Error('Heading component is not registered');
    }
    render(
      <>
        {heading.render({
          id: 'heading-transparent',
          content: 'Transparent heading',
          backgroundColor: 'rgba(255, 255, 255, 0)'
        } as unknown as Parameters<NonNullable<typeof heading.render>>[0])}
      </>
    );
    expect(screen.getByText('Transparent heading')).toHaveStyle({ backgroundColor: 'transparent' });
  });

  it('does not render when renderWhen resolves false', () => {
    const config = createPageBuilderConfig({
      bindingOptions: [],
      resolveBinding: (text) => text ?? ''
    });
    const heading = config.components?.Heading;
    if (!heading?.render) {
      throw new Error('Heading component is not registered');
    }
    render(
      <>
        {heading.render({
          id: 'heading-hidden',
          content: 'Hidden heading',
          renderWhen: 'false'
        } as unknown as Parameters<NonNullable<typeof heading.render>>[0])}
      </>
    );
    expect(screen.queryByText('Hidden heading')).not.toBeInTheDocument();
  });
});

describe('Conditional component', () => {
  const config = createPageBuilderConfig({
    bindingOptions: [],
    resolveBinding: (text) => text ?? ''
  });
  const conditional = config.components?.Conditional;
  const helperText = 'Provide or bind to a string that matches one of the defined case keys (e.g., "primary-view").';

  if (!conditional?.render) {
    throw new Error('Conditional component is not registered');
  }

  const slotFactory = (testId: string, label: string) => ({ className }: { className?: string }) => (
    <div data-testid={testId} className={className}>
      {label}
    </div>
  );

  it('renders the case whose key matches the provided string', () => {
    render(
      <>
        {conditional.render({
          id: 'conditional-test',
          activeCaseKey: 'secondary',
          cases: [
            { caseKey: 'primary', label: 'Primary view', slot: slotFactory('slot-primary', 'Primary') },
            { caseKey: 'secondary', label: 'Secondary view', slot: slotFactory('slot-secondary', 'Secondary') },
            { caseKey: 'tertiary', label: 'Tertiary view', slot: slotFactory('slot-tertiary', 'Tertiary') }
          ]
        } as unknown as Parameters<NonNullable<typeof conditional.render>>[0])}
      </>
    );

    expect(screen.getByTestId('slot-secondary')).toBeInTheDocument();
    expect(screen.queryByTestId('slot-primary')).not.toBeInTheDocument();
  });

  it('falls back to the first case when the key is missing', () => {
    render(
      <>
        {conditional.render({
          id: 'conditional-test-fallback',
          activeCaseKey: 'unknown-value',
          cases: [
            { caseKey: 'alpha', label: 'Alpha view', slot: slotFactory('slot-alpha', 'Alpha') },
            { caseKey: 'beta', label: 'Beta view', slot: slotFactory('slot-beta', 'Beta') }
          ]
        } as unknown as Parameters<NonNullable<typeof conditional.render>>[0])}
      </>
    );

    expect(screen.getByTestId('slot-alpha')).toBeInTheDocument();
    expect(screen.queryByTestId('slot-beta')).not.toBeInTheDocument();
  });

  it('hides helper UI when the active case slot has content', () => {
    render(
      <>
        {conditional.render({
          id: 'conditional-hide-helper',
          activeCaseKey: 'primary',
          cases: [{ caseKey: 'primary', label: 'Primary view', slot: slotFactory('slot-hide-helper', 'Rendered slot') }]
        } as unknown as Parameters<NonNullable<typeof conditional.render>>[0])}
      </>
    );

    expect(screen.getByTestId('slot-hide-helper')).toBeInTheDocument();
    expect(screen.queryByText('Conditional render')).not.toBeInTheDocument();
    expect(screen.queryByText(helperText)).not.toBeInTheDocument();
  });

  it('shows helper UI when no slot content exists', () => {
    render(
      <>
        {conditional.render({
          id: 'conditional-show-helper',
          activeCaseKey: 'primary',
          cases: [{ caseKey: 'primary', label: 'Primary view' }]
        } as unknown as Parameters<NonNullable<typeof conditional.render>>[0])}
      </>
    );

    expect(screen.getByText('Conditional render')).toBeInTheDocument();
    expect(screen.getByText(helperText)).toBeInTheDocument();
  });
});

describe('List component dynamic data', () => {
  const dynamicList: ScalarValue = [
    { title: 'First article', description: 'Intro piece', icon: '🔥' },
    'Loose string entry'
  ];
  const baseBindingOptions = [
    { label: 'Dynamic list', value: 'dynamic-list', dataType: 'list' as const, listItemType: 'object' as const }
  ];

  it('renders entries from a bound list input', () => {
    const config = createPageBuilderConfig({
      bindingOptions: baseBindingOptions,
      resolveBinding: (text) => text ?? '',
      resolveBindingValue: (bindingId) => (bindingId === 'dynamic-list' ? dynamicList : undefined)
    });
    const listComponent = config.components?.List;
    if (!listComponent?.render) {
      throw new Error('List component is not registered');
    }
    render(
      <>
        {listComponent.render({
          id: 'list-dynamic',
          variant: 'bullet',
          dataSource: createDynamicBindingState('dynamic-list', '[]')
        } as unknown as Parameters<NonNullable<typeof listComponent.render>>[0])}
      </>
    );
    expect(screen.getByText('First article')).toBeInTheDocument();
    expect(screen.getByText('Loose string entry')).toBeInTheDocument();
    expect(screen.getByText('🔥')).toBeInTheDocument();
  });

  it('falls back to manual items when no dynamic data is available', () => {
    const config = createPageBuilderConfig({
      bindingOptions: [],
      resolveBinding: (text) => text ?? '',
      resolveBindingValue: () => undefined
    });
    const listComponent = config.components?.List;
    if (!listComponent?.render) {
      throw new Error('List component is not registered');
    }
    render(
      <>
        {listComponent.render({
          id: 'list-manual',
          variant: 'plain',
          dataSource: createDynamicBindingState('missing-list', '[]'),
          items: [{ text: 'Manual entry', description: 'Fallback' }]
        } as unknown as Parameters<NonNullable<typeof listComponent.render>>[0])}
      </>
    );
    expect(screen.getByText('Manual entry')).toBeInTheDocument();
    expect(screen.getByText('Fallback')).toBeInTheDocument();
  });
});

describe('List custom slot rendering', () => {
  const customDynamicList: ScalarValue = [
    { title: 'First article', description: 'Alpha state' },
    { title: 'Second article', description: 'Beta state' }
  ];
  const baseBindingOptions = [
    { label: 'Dynamic list', value: 'dynamic-list', dataType: 'list' as const, listItemType: 'object' as const }
  ];

  const createResolvers = () => ({
    resolveBinding: (text?: string, bindingId?: string, propertyPath?: string[]) => {
      if (bindingId !== 'dynamic-list') {
        return text ?? '';
      }
      const normalizedPath = projectListSlotPropertyPath(bindingId, propertyPath);
      const resolvedValue = resolvePropertyPathValue(customDynamicList, normalizedPath);
      if (typeof resolvedValue === 'undefined') {
        return text ?? '';
      }
      if (typeof resolvedValue === 'string') {
        return resolvedValue;
      }
      if (typeof resolvedValue === 'number' || typeof resolvedValue === 'boolean') {
        return String(resolvedValue);
      }
      return text ?? '';
    },
    resolveBindingValue: (bindingId?: string, propertyPath?: string[]) => {
      if (bindingId !== 'dynamic-list') {
        return undefined;
      }
      const normalizedPath = projectListSlotPropertyPath(bindingId, propertyPath);
      return resolvePropertyPathValue(customDynamicList, normalizedPath);
    }
  });

  const createConfig = () => {
    const resolvers = createResolvers();
    return createPageBuilderConfig({
      bindingOptions: baseBindingOptions,
      resolveBinding: resolvers.resolveBinding,
      resolveBindingValue: resolvers.resolveBindingValue
    });
  };

  const SlotProbe = () => {
    const { currentIndex, itemValue } = useListSlotContext();
    const title =
      itemValue && typeof itemValue === 'object' && !Array.isArray(itemValue)
        ? ((itemValue as Record<string, ScalarValue>).title as string)
        : undefined;
    return <div data-testid={`custom-slot-${currentIndex}`}>{title ?? `Item ${currentIndex + 1}`}</div>;
  };

  it('renders custom slot entries with context data', () => {
    const config = createConfig();
    const listComponent = config.components?.List;
    if (!listComponent?.render) {
      throw new Error('List component is not registered');
    }
    render(
      <>
        {listComponent.render({
          id: 'list-custom-slot',
          renderMode: 'custom',
          dataSource: createDynamicBindingState('dynamic-list', '[]'),
          customItemSlot: () => <SlotProbe />
        } as unknown as Parameters<NonNullable<typeof listComponent.render>>[0])}
      </>
    );
    expect(screen.getByTestId('custom-slot-0')).toHaveTextContent('First article');
    expect(screen.getByTestId('custom-slot-1')).toHaveTextContent('Second article');
  });

  it('applies current list index to nested bindings inside slots', () => {
    const config = createConfig();
    const listComponent = config.components?.List;
    const heading = config.components?.Heading;
    if (!listComponent?.render || !heading?.render) {
      throw new Error('Required components are not registered');
    }
    const slotRenderer = () => (
      <>
        {heading.render({
          id: 'slot-heading',
          content: createDynamicBindingState('dynamic-list', '[]', ['0', 'title'])
        } as unknown as Parameters<NonNullable<typeof heading.render>>[0])}
      </>
    );
    render(
      <>
        {listComponent.render({
          id: 'list-custom-slot-heading',
          renderMode: 'custom',
          dataSource: createDynamicBindingState('dynamic-list', '[]'),
          customItemSlot: slotRenderer
        } as unknown as Parameters<NonNullable<typeof listComponent.render>>[0])}
      </>
    );
    expect(screen.getByText('First article')).toBeInTheDocument();
    expect(screen.getByText('Second article')).toBeInTheDocument();
  });

  it('shows helpers when slot configuration is incomplete', () => {
    const config = createConfig();
    const listComponent = config.components?.List;
    if (!listComponent?.render) {
      throw new Error('List component is not registered');
    }
    const { rerender } = render(
      <>
        {listComponent.render({
          id: 'list-missing-slot',
          renderMode: 'custom',
          dataSource: createDynamicBindingState('dynamic-list', '[]')
        } as unknown as Parameters<NonNullable<typeof listComponent.render>>[0])}
      </>
    );
    expect(screen.getByText('Add a component to the custom list slot to start designing each entry.')).toBeInTheDocument();
    rerender(
      <>
        {listComponent.render({
          id: 'list-empty-slot',
          renderMode: 'custom',
          customItemSlot: () => <SlotProbe />
        } as unknown as Parameters<NonNullable<typeof listComponent.render>>[0])}
      </>
    );
    expect(
      screen.getByText('Connect a data source or add manual list items to preview custom entries.')
    ).toBeInTheDocument();
  });

  it('renders current list item scoped bindings inside custom slots', () => {
    const listComponentId = 'list-scoped';
    const dynamicBindingId = 'dynamic-items';
    const scopedBindingId = `${LIST_SCOPE_BINDING_PREFIX}${listComponentId}`;
    const config = createPageBuilderConfig({
      bindingOptions: [
        { label: 'Dynamic items', value: dynamicBindingId, dataType: 'list', listItemType: 'number' },
        { label: 'Current list item', value: scopedBindingId, dataType: 'number' }
      ],
      resolveBinding: (text?: string, bindingId?: string, propertyPath?: string[]) => {
        const scopedValue = resolveListSlotScopedValue(bindingId, propertyPath);
        if (typeof scopedValue !== 'undefined') {
          return typeof scopedValue === 'string' ? scopedValue : String(scopedValue);
        }
        return text ?? bindingId ?? '';
      },
      resolveBindingValue: (bindingId?: string) => {
        if (bindingId === dynamicBindingId) {
          return [1, 2, 4, 5];
        }
        return undefined;
      }
    });
    const listComponent = config.components?.List;
    const heading = config.components?.Heading;
    if (!listComponent?.render || !heading?.render) {
      throw new Error('Required components are not registered');
    }
    const slotRenderer = () => (
      <>
        {heading.render({
          id: 'slot-heading',
          content: createDynamicBindingState(scopedBindingId, 'fallback'),
          customAttributes: [{ id: 'slot-attr', name: 'data-testid', value: 'slot-value' }]
        } as unknown as Parameters<NonNullable<typeof heading.render>>[0])}
      </>
    );
    render(
      <>
        {listComponent.render({
          id: listComponentId,
          renderMode: 'custom',
          dataSource: createDynamicBindingState(dynamicBindingId, '[]'),
          customItemSlot: slotRenderer
        } as unknown as Parameters<NonNullable<typeof listComponent.render>>[0])}
      </>
    );
    const resolvedValues = screen.getAllByTestId('slot-value').map((node) => node.textContent);
    expect(resolvedValues).toEqual(['1', '2', '4', '5']);
  });
});
