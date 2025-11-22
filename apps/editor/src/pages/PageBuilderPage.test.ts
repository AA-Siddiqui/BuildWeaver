import type { ComponentData, Content, Data } from '@measured/puck';
import { derivePuckSessionKey, normalizeBuilderStateForSave } from './PageBuilderPage';

jest.mock('@measured/puck', () => ({
  Puck: () => null
}));

describe('normalizeBuilderStateForSave', () => {
  const createComponent = (overrides: Partial<ComponentData> = {}): ComponentData => {
    const base: ComponentData = {
      type: 'Heading',
      props: {
        id: 'component-1',
        content: 'Hello'
      }
    } as ComponentData;

    return {
      ...base,
      ...overrides,
      props: {
        ...(base.props ?? {}),
        ...(overrides.props ?? {})
      }
    };
  };

  it('converts map-based zones into serializable objects', () => {
    const component = createComponent();
    const state = {
      root: { id: 'root', props: {}, children: [] },
      content: [component],
      zones: new Map<string, Content>([['root', [component]]]) as unknown as Data['zones']
    } as Data;

    const normalized = normalizeBuilderStateForSave(state);
    const normalizedData = normalized as Data;
    expect(normalizedData.content).toHaveLength(1);
    expect(normalizedData.zones?.root).toHaveLength(1);
    expect((normalizedData.zones?.root?.[0] as ComponentData).props).toHaveProperty('content', 'Hello');
  });

  it('clones zone and content entries to avoid shared references', () => {
    const component = createComponent();
    const state = {
      root: { id: 'root', props: {}, children: [] },
      content: [component],
      zones: { root: [component] }
    } as Data;

    const normalized = normalizeBuilderStateForSave(state);
    const normalizedData = normalized as Data;
    expect(normalized).not.toBe(state);
    expect(normalizedData.content[0]).not.toBe(component);
    expect((normalizedData.zones?.root?.[0] as ComponentData)).not.toBe(component);
  });
});

describe('derivePuckSessionKey', () => {
  it('uses page id and updatedAt when provided', () => {
    const key = derivePuckSessionKey({ id: 'page-1', updatedAt: '2025-11-21T12:52:54.675Z' });
    expect(key).toBe('page-1:2025-11-21T12:52:54.675Z');
  });

  it('falls back to provided page id when updatedAt is missing', () => {
    const key = derivePuckSessionKey(undefined, 'fallback-page');
    expect(key).toBe('fallback-page:initial');
  });

  it('produces different keys for different timestamps', () => {
    const first = derivePuckSessionKey({ id: 'page-2', updatedAt: '2025-01-01T00:00:00.000Z' });
    const second = derivePuckSessionKey({ id: 'page-2', updatedAt: '2025-01-02T00:00:00.000Z' });
    expect(first).not.toBe(second);
  });
});
