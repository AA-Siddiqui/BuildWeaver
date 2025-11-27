import { SnapshotHistory } from './snapshotHistory';

type Snapshot = { value: number };

const cloneSnapshot = (snapshot: Snapshot): Snapshot => ({ ...snapshot });

const createHistory = () =>
  new SnapshotHistory<Snapshot>({
    clone: cloneSnapshot
  });

describe('SnapshotHistory', () => {
  it('records previous state when a change is observed', () => {
    const history = createHistory();
    history.reset({ value: 1 });
    history.observe({ value: 1 });
    history.observe({ value: 2 });
    expect(history.getUndoDepth()).toBe(1);
    const restored = history.undo({ value: 2 });
    expect(restored).toEqual({ value: 1 });
  });

  it('does not record when the snapshot hash is unchanged', () => {
    const history = createHistory();
    history.reset({ value: 5 });
    history.observe({ value: 5 });
    history.observe({ value: 5 });
    expect(history.getUndoDepth()).toBe(0);
  });

  it('suppresses the next diff when requested', () => {
    const history = createHistory();
    history.reset({ value: 1 });
    history.observe({ value: 2 });
    history.suppressNextDiff();
    history.observe({ value: 3 });
    expect(history.getUndoDepth()).toBe(1);
    const restored = history.undo({ value: 3 });
    expect(restored).toEqual({ value: 1 });
  });

  it('clears undo and redo stacks on reset', () => {
    const history = createHistory();
    history.reset({ value: 1 });
    history.observe({ value: 2 });
    expect(history.getUndoDepth()).toBe(1);
    history.reset({ value: 99 });
    expect(history.getUndoDepth()).toBe(0);
    expect(history.undo({ value: 99 })).toBeNull();
  });

  it('records redo states as expected', () => {
    const history = createHistory();
    history.reset({ value: 1 });
    history.observe({ value: 2 });
    const previous = history.undo({ value: 2 });
    expect(previous).toEqual({ value: 1 });
    expect(history.getRedoDepth()).toBe(1);
    const next = history.redo({ value: 1 });
    expect(next).toEqual({ value: 2 });
  });
});
