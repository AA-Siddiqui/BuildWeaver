import type { PageBuilderState, PageDynamicInput } from '../../types/api';
import { clearBuilderDraft, loadBuilderDraft, persistBuilderDraft, buildDraftKey } from './draft-storage';

class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('draft-storage', () => {
  const draftState: PageBuilderState = {
    root: { id: 'root', props: {}, children: [] },
    content: [
      {
        type: 'Heading',
        props: {
          id: 'component-1',
          content: 'Hello world'
        }
      }
    ]
  } as PageBuilderState;
  const inputs: PageDynamicInput[] = [{ id: 'dyn-1', label: 'Customer name', dataType: 'string' }];

  it('persists and restores drafts with dynamic inputs', () => {
    const storage = new MockStorage();
    const savedAt = persistBuilderDraft('project:page', draftState, inputs, storage);
    expect(typeof savedAt).toBe('number');
    const hydrated = loadBuilderDraft('project:page', storage);
    expect(hydrated).not.toBeNull();
    if (!hydrated) {
      return;
    }
    expect(hydrated.savedAt).toBe(savedAt);
    expect(hydrated.state).toEqual(draftState);
    expect(hydrated.dynamicInputs).toEqual(inputs);
  });

  it('clears drafts when requested', () => {
    const storage = new MockStorage();
    persistBuilderDraft('project:page', draftState, inputs, storage);
    clearBuilderDraft('project:page', storage);
    expect(loadBuilderDraft('project:page', storage)).toBeNull();
  });

  it('drops invalid payloads', () => {
    const storage = new MockStorage();
    const key = buildDraftKey('project:page');
    storage.setItem(key, '{not-json');
    expect(loadBuilderDraft('project:page', storage)).toBeNull();
    expect(storage.length).toBe(0);
  });
});
