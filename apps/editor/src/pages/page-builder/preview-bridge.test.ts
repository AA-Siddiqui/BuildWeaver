import type { Data } from '@measured/puck';
import type { PageDynamicInput } from '../../types/api';
import { consumePreviewSnapshot, createPreviewSnapshotToken, prunePreviewSnapshots } from './preview-bridge';

describe('preview bridge', () => {
  const baseState: Data = ({
    root: { id: 'root', props: {}, children: [] },
    content: []
  } as unknown) as Data;
  const baseInputs: PageDynamicInput[] = [{ id: 'input-1', label: 'Name', dataType: 'string' }];

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores the current builder snapshot and retrieves it once', () => {
    const token = createPreviewSnapshotToken(baseState, baseInputs);
    expect(token).toBeTruthy();

    const snapshot = token ? consumePreviewSnapshot(token) : null;
    expect(snapshot).not.toBeNull();
    expect(snapshot?.state).toEqual(baseState);
    expect(snapshot?.inputs).toEqual(baseInputs);

    // Snapshot should be removed after consumption.
    const repeatedRead = token ? consumePreviewSnapshot(token) : null;
    expect(repeatedRead).toBeNull();
  });

  it('prunes expired snapshots', () => {
    const expiredKey = 'bw-preview:expired';
    window.localStorage.setItem(
      expiredKey,
      JSON.stringify({
        state: baseState,
        inputs: baseInputs,
        createdAt: Date.now() - 10 * 60 * 1000
      })
    );

    prunePreviewSnapshots();

    expect(window.localStorage.getItem(expiredKey)).toBeNull();
  });
});
