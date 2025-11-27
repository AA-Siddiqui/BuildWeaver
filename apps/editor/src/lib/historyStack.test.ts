import { HistoryStack } from './historyStack';

describe('HistoryStack', () => {
  it('returns the last recorded snapshot on undo', () => {
    const stack = new HistoryStack<number>();
    stack.record(1);
    stack.record(2);
    expect(stack.undo(3)).toBe(2);
    expect(stack.getUndoDepth()).toBe(1);
    expect(stack.getRedoDepth()).toBe(1);
  });

  it('returns null when undo is called without history', () => {
    const stack = new HistoryStack<number>();
    expect(stack.undo(1)).toBeNull();
    expect(stack.getUndoDepth()).toBe(0);
    expect(stack.getRedoDepth()).toBe(0);
  });

  it('allows redo after an undo', () => {
    const stack = new HistoryStack<number>();
    stack.record(1);
    stack.record(2);
    stack.undo(3);
    expect(stack.redo(3)).toBe(3);
    expect(stack.getUndoDepth()).toBe(2);
    expect(stack.getRedoDepth()).toBe(0);
  });

  it('respects the configured history limit', () => {
    const stack = new HistoryStack<number>({ limit: 2 });
    stack.record(1);
    stack.record(2);
    stack.record(3);
    expect(stack.getUndoDepth()).toBe(2);
    expect(stack.undo(4)).toBe(3);
    expect(stack.undo(3)).toBe(2);
    expect(stack.undo(2)).toBeNull();
  });

  it('clones snapshots to avoid shared references', () => {
    type Snapshot = { value: number };
    const stack = new HistoryStack<Snapshot>({ clone: (snapshot) => ({ ...snapshot }) });
    const original = { value: 1 };
    stack.record(original);
    original.value = 99;
    const restored = stack.undo({ value: 0 });
    expect(restored).toEqual({ value: 1 });
    expect(restored).not.toBe(original);
  });

  it('clears both stacks when reset is called', () => {
    const stack = new HistoryStack<number>();
    stack.record(1);
    stack.record(2);
    stack.undo(3);
    stack.reset();
    expect(stack.getUndoDepth()).toBe(0);
    expect(stack.getRedoDepth()).toBe(0);
    expect(stack.undo(0)).toBeNull();
    expect(stack.redo(0)).toBeNull();
  });
});
