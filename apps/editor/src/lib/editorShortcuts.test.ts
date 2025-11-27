import { processEditorShortcut } from './editorShortcuts';

describe('processEditorShortcut', () => {
  const createEvent = (key: string, overrides: Partial<KeyboardEvent & { target: EventTarget | null }> = {}) => {
    const target = overrides.target ?? document.createElement('div');
    const preventDefault = jest.fn();
    const event = {
      key,
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault,
      target,
      ...overrides
    } as unknown as KeyboardEvent;
    return { event, preventDefault };
  };

  it('invokes onSave and prevents default for Ctrl+S', () => {
    const onSave = jest.fn();
    const { event, preventDefault } = createEvent('s');
    const handled = processEditorShortcut(event, { onSave });
    expect(handled).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('invokes onUndo for Ctrl+Z when not focused in input', () => {
    const onUndo = jest.fn();
    const { event, preventDefault } = createEvent('z');
    const handled = processEditorShortcut(event, { onUndo });
    expect(handled).toBe(true);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('skips undo when target is an input element', () => {
    const onUndo = jest.fn();
    const input = document.createElement('input');
    const { event, preventDefault } = createEvent('z', { target: input });
    const handled = processEditorShortcut(event, { onUndo });
    expect(handled).toBe(false);
    expect(onUndo).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('invokes onRedo for Ctrl+Y', () => {
    const onRedo = jest.fn();
    const { event, preventDefault } = createEvent('y');
    const handled = processEditorShortcut(event, { onRedo });
    expect(handled).toBe(true);
    expect(onRedo).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('invokes onRedo for Ctrl+Shift+Z', () => {
    const onRedo = jest.fn();
    const { event, preventDefault } = createEvent('z', { shiftKey: true });
    const handled = processEditorShortcut(event, { onRedo });
    expect(handled).toBe(true);
    expect(onRedo).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('logs when redo is ignored due to editable target', () => {
    const logger = jest.fn();
    const input = document.createElement('textarea');
    const { event } = createEvent('y', { target: input });
    const handled = processEditorShortcut(event, { onRedo: jest.fn(), logger });
    expect(handled).toBe(false);
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('ignored'), expect.objectContaining({ combo: expect.any(String) }));
  });

  it('respects allowInputTargets when undoing inside form fields', () => {
    const input = document.createElement('input');
    const onUndo = jest.fn();
    const { event, preventDefault } = createEvent('z', { target: input });
    const handled = processEditorShortcut(event, { onUndo, allowInputTargets: true });
    expect(handled).toBe(true);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});
