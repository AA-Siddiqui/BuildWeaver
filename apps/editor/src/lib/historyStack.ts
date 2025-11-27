export type HistoryStackOptions<T> = {
  limit?: number;
  clone?: (value: T) => T;
};

const identity = <T>(value: T): T => value;

export class HistoryStack<T> {
  private undoStack: T[] = [];
  private redoStack: T[] = [];
  private readonly limit: number;
  private readonly clone: (value: T) => T;

  constructor(options?: HistoryStackOptions<T>) {
    this.limit = options?.limit ?? 50;
    this.clone = options?.clone ?? identity;
  }

  record(value: T) {
    const snapshot = this.clone(value);
    this.undoStack = [...this.undoStack, snapshot];
    this.undoStack = this.trim(this.undoStack);
    this.redoStack = [];
    return snapshot;
  }

  undo(current: T): T | null {
    if (!this.undoStack.length) {
      return null;
    }
    const snapshot = this.undoStack[this.undoStack.length - 1];
    this.undoStack = this.undoStack.slice(0, -1);
    this.pushRedo(current);
    return this.clone(snapshot);
  }

  redo(current: T): T | null {
    if (!this.redoStack.length) {
      return null;
    }
    const snapshot = this.redoStack[this.redoStack.length - 1];
    this.redoStack = this.redoStack.slice(0, -1);
    this.pushUndo(current);
    return this.clone(snapshot);
  }

  reset() {
    this.undoStack = [];
    this.redoStack = [];
  }

  getUndoDepth() {
    return this.undoStack.length;
  }

  getRedoDepth() {
    return this.redoStack.length;
  }

  private pushRedo(value: T) {
    const snapshot = this.clone(value);
    this.redoStack = [...this.redoStack, snapshot];
    this.redoStack = this.trim(this.redoStack);
  }

  private pushUndo(value: T) {
    const snapshot = this.clone(value);
    this.undoStack = [...this.undoStack, snapshot];
    this.undoStack = this.trim(this.undoStack);
  }

  private trim(stack: T[]) {
    if (stack.length <= this.limit) {
      return stack;
    }
    return stack.slice(stack.length - this.limit);
  }
}
