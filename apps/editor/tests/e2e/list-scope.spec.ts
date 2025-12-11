import { expect, test } from '@playwright/test';
import {
  LIST_SCOPE_BINDING_PREFIX,
  popListSlotRuntimeContext,
  projectListSlotPropertyPath,
  pushListSlotRuntimeContext,
  resolveListSlotScopedValue
} from '../../src/pages/page-builder/list-slot-context';

const withListSlotContext = async (
  value: Parameters<typeof pushListSlotRuntimeContext>[0],
  assertion: () => void | Promise<void>
) => {
  pushListSlotRuntimeContext(value);
  try {
    await assertion();
  } finally {
    popListSlotRuntimeContext();
  }
};

test.describe('List slot scoped bindings', () => {
  test('resolveListSlotScopedValue exposes nested values for active slot', async () => {
    const itemValue = { title: 'Changelog entry', meta: { views: 42 } };
    const bindingId = `${LIST_SCOPE_BINDING_PREFIX}component-hero-list`;
    await withListSlotContext(
      {
        listComponentId: 'component-hero-list',
        sourceBindingId: 'project-feed',
        currentIndex: 2,
        itemValue
      },
      () => {
        expect(resolveListSlotScopedValue(bindingId)).toEqual(itemValue);
        expect(resolveListSlotScopedValue(bindingId, ['meta', 'views'])).toBe(42);
      }
    );
  });

  test('projectListSlotPropertyPath rewrites template indices using runtime context', async () => {
    await withListSlotContext(
      {
        listComponentId: 'component-hero-list',
        sourceBindingId: 'project-feed',
        currentIndex: 5,
        itemValue: { title: 'Sample' }
      },
      () => {
        expect(projectListSlotPropertyPath('project-feed', ['0', 'title'])).toEqual(['5', 'title']);
        expect(projectListSlotPropertyPath('unrelated-binding', ['0', 'title'])).toEqual(['0', 'title']);
      }
    );
  });

  test('scoped values are isolated between different list components', async () => {
    const primaryBindingId = `${LIST_SCOPE_BINDING_PREFIX}component-primary`;
    const secondaryBindingId = `${LIST_SCOPE_BINDING_PREFIX}component-secondary`;
    await withListSlotContext(
      {
        listComponentId: 'component-primary',
        sourceBindingId: 'announcement-feed',
        currentIndex: 0,
        itemValue: { title: 'Primary item' }
      },
      () => {
        expect(resolveListSlotScopedValue(primaryBindingId, ['title'])).toBe('Primary item');
        expect(resolveListSlotScopedValue(secondaryBindingId, ['title'])).toBeUndefined();
      }
    );
  });
});
