import { HistoryStack } from './historyStack';

type SnapshotHistoryOptions<T> = {
  limit?: number;
  clone: (snapshot: T) => T;
  hash?: (snapshot: T) => string;
  logger?: (message: string, meta?: Record<string, unknown>) => void;
};

const defaultHash = <T>(snapshot: T) => JSON.stringify(snapshot);

export class SnapshotHistory<T> {
  private readonly stack: HistoryStack<T>;
  private lastSnapshot: T | null = null;
  private lastHash = '';
  private suppressNext = false;

  constructor(private readonly options: SnapshotHistoryOptions<T>) {
    this.stack = new HistoryStack<T>({ limit: options.limit, clone: options.clone });
  }

  observe(snapshot: T, meta?: Record<string, unknown>) {
    const cloned = this.options.clone(snapshot);
    const hash = (this.options.hash ?? defaultHash)(cloned);
    if (!this.lastSnapshot) {
      this.lastSnapshot = cloned;
      this.lastHash = hash;
      this.log('History baseline established', meta);
      return;
    }
    if (this.suppressNext) {
      this.suppressNext = false;
      this.lastSnapshot = cloned;
      this.lastHash = hash;
      this.log('History change suppressed', meta);
      return;
    }
    if (hash === this.lastHash) {
      return;
    }
    this.stack.record(this.lastSnapshot);
    this.lastSnapshot = cloned;
    this.lastHash = hash;
    this.log('History snapshot recorded', meta);
  }

  reset(snapshot: T, meta?: Record<string, unknown>) {
    this.stack.reset();
    this.lastSnapshot = this.options.clone(snapshot);
    this.lastHash = (this.options.hash ?? defaultHash)(this.lastSnapshot);
    this.suppressNext = false;
    this.log('History reset', meta);
  }

  suppressNextDiff() {
    this.suppressNext = true;
  }

  undo(current: T): T | null {
    return this.stack.undo(this.options.clone(current));
  }

  redo(current: T): T | null {
    return this.stack.redo(this.options.clone(current));
  }

  getUndoDepth() {
    return this.stack.getUndoDepth();
  }

  getRedoDepth() {
    return this.stack.getRedoDepth();
  }

  private log(message: string, meta?: Record<string, unknown>) {
    this.options.logger?.(message, meta);
  }
}
