import { DragHistoryBuffer } from './dragHistoryBuffer';

describe('DragHistoryBuffer', () => {
  it('emits only the final snapshot when a drag ends', () => {
    const buffer = new DragHistoryBuffer<string>();
    const processor = jest.fn();

    buffer.begin({ reason: 'node-drag' });
    buffer.capture('snapshot-1');
    buffer.capture('snapshot-2');
    buffer.end(processor);

    expect(processor).toHaveBeenCalledTimes(1);
    expect(processor).toHaveBeenCalledWith('snapshot-2', { reason: 'node-drag' });
  });

  it('ignores captures when not dragging', () => {
    const buffer = new DragHistoryBuffer<string>();
    const processor = jest.fn();

    buffer.capture('snapshot');
    buffer.end(processor);

    expect(processor).not.toHaveBeenCalled();
  });

  it('resets internal state', () => {
    const buffer = new DragHistoryBuffer<string>();
    const processor = jest.fn();

    buffer.begin({ reason: 'node-drag' });
    buffer.capture('snapshot-1');
    buffer.reset();
    buffer.end(processor);

    expect(processor).not.toHaveBeenCalled();
  });

  it('reports active drag status', () => {
    const buffer = new DragHistoryBuffer<string>();
    expect(buffer.isActive()).toBe(false);
    buffer.begin({ reason: 'node-drag' });
    expect(buffer.isActive()).toBe(true);
    buffer.end(() => undefined);
    expect(buffer.isActive()).toBe(false);
  });
});
