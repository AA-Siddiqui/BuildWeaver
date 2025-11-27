type Reason = 'node-drag' | 'connect' | string;

export type DragHistoryContext = {
  reason: Reason;
  nodeIds?: string[];
};

export class DragHistoryBuffer<TSnapshot> {
  private pending?: TSnapshot;
  private context: DragHistoryContext | null = null;
  private dragging = false;

  begin(context: DragHistoryContext): void {
    this.dragging = true;
    this.context = context;
    this.pending = undefined;
  }

  capture(snapshot: TSnapshot): void {
    if (!this.dragging) {
      this.pending = undefined;
      this.context = null;
      return;
    }
    this.pending = snapshot;
  }

  end(processor: (snapshot: TSnapshot, context: DragHistoryContext) => void): void {
    if (this.dragging && this.pending && this.context) {
      processor(this.pending, this.context);
    }
    this.pending = undefined;
    this.context = null;
    this.dragging = false;
  }

  reset(): void {
    this.pending = undefined;
    this.context = null;
    this.dragging = false;
  }

  isActive(): boolean {
    return this.dragging;
  }
}
