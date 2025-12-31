import type { ComponentData } from '@measured/puck';
import type { ComponentBindingReference } from '@buildweaver/libs';
import {
  applyParameterOverrides,
  buildBindingSignature,
  mergeParameterOverrides,
  isSlotBindingReference
} from './component-library';
import { createDynamicBindingState } from './dynamic-binding';

describe('component library helpers', () => {
  it('applies parameter overrides to matching dynamic bindings', () => {
    const definition: ComponentData = {
      type: 'Heading',
      props: {
        id: 'hero-1',
        content: createDynamicBindingState('title', '')
      }
    };

    const parameters: ComponentBindingReference[] = [
      { bindingId: 'title', componentId: 'hero-1', exposeAsParameter: true }
    ];
    const signature = buildBindingSignature(parameters[0]!);
    const overrides = {
      [signature]: createDynamicBindingState('article.title', '')
    } as const;

    const result = applyParameterOverrides(definition, overrides, parameters);
    const props = result?.props as { content: { bindingId: string } } | undefined;
    expect(props?.content.bindingId).toBe('article.title');
  });

  it('ignores overrides that are not marked as parameters', () => {
    const definition: ComponentData = {
      type: 'Heading',
      props: {
        id: 'hero-1',
        content: {
          bindingId: 'title'
        }
      }
    };

    const signature = buildBindingSignature({ bindingId: 'title', componentId: 'hero-1' });

    const result = applyParameterOverrides(definition, { [signature]: createDynamicBindingState('next.title', '') }, []);
    const props = result?.props as { content: { bindingId: string } } | undefined;
    expect(props?.content.bindingId).toBe('title');
  });

  it('merges root-level props into parameter overrides', () => {
    const parameters: ComponentBindingReference[] = [{ bindingId: 'title', componentId: 'hero-1', exposeAsParameter: true }];
    const signature = buildBindingSignature(parameters[0]!);
    const merged = mergeParameterOverrides(parameters, { [signature]: createDynamicBindingState('article.heading', '') }, {});

    expect((merged[signature] as { bindingId: string }).bindingId).toBe('article.heading');
  });

  it('applies overrides within nested slot content', () => {
    const definition: ComponentData = {
      type: 'Section',
      props: {
        id: 'section-1',
        contentSlot: [
          {
            type: 'Heading',
            props: {
              id: 'slot-heading',
              content: createDynamicBindingState('title', '')
            }
          }
        ]
      }
    };

    const parameters: ComponentBindingReference[] = [{ bindingId: 'title', componentId: 'slot-heading', exposeAsParameter: true }];
    const signature = buildBindingSignature(parameters[0]!);
    const overrides = { [signature]: createDynamicBindingState('article.title', '') };

    const result = applyParameterOverrides(definition, overrides, parameters);
    const slotContent = (result?.props as { contentSlot?: Array<{ props: { content: { bindingId: string } } }> }).contentSlot;
    expect(slotContent?.[0]?.props.content.bindingId).toBe('article.title');
  });

  it('treats bindings without componentId as non-slot', () => {
    const ref: ComponentBindingReference = { bindingId: 'title', componentId: undefined };
    expect(isSlotBindingReference(ref, 'hero-1')).toBe(false);
  });
});
