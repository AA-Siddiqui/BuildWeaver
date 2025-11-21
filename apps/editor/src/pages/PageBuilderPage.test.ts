import type { ComponentData, Content, Data } from '@measured/puck';
import { normalizeBuilderStateForSave } from './PageBuilderPage';

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
