export type ShortcutLogger = (message: string, meta?: Record<string, unknown>) => void;

export type EditorShortcutHandlers = {
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSelectAll?: () => void;
  logger?: ShortcutLogger;
  allowInputTargets?: boolean;
};

const isEditableTarget = (target: EventTarget | null): target is HTMLElement => {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
};

const describeKeyCombo = (event: KeyboardEvent) => {
  const parts: string[] = [];
  if (event.metaKey && !event.ctrlKey) {
    parts.push('Cmd');
  } else if (event.ctrlKey) {
    parts.push('Ctrl');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }
  if (event.altKey) {
    parts.push('Alt');
  }
  parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
  return parts.join('+');
};

export const processEditorShortcut = (event: KeyboardEvent, handlers: EditorShortcutHandlers): boolean => {
  const hasPrimaryModifier = event.ctrlKey || event.metaKey;
  if (!hasPrimaryModifier) {
    return false;
  }

  const normalizedKey = event.key.toLowerCase();
  const isEditable = isEditableTarget(event.target);
  const allowInputTargets = handlers.allowInputTargets ?? false;

  const log = (message: string, meta?: Record<string, unknown>) => handlers.logger?.(message, meta);

  if (normalizedKey === 's' && handlers.onSave) {
    event.preventDefault();
    handlers.onSave();
    log('Save shortcut handled', { combo: describeKeyCombo(event) });
    return true;
  }

  const isUndoKey = normalizedKey === 'z' && !event.shiftKey;
  if (isUndoKey) {
    if (isEditable && !allowInputTargets) {
      log('Undo shortcut ignored due to editable target', { combo: describeKeyCombo(event) });
      return false;
    }
    if (handlers.onUndo) {
      event.preventDefault();
      handlers.onUndo();
      log('Undo shortcut handled', { combo: describeKeyCombo(event) });
      return true;
    }
    return false;
  }

  const isRedoKey = normalizedKey === 'y' || (normalizedKey === 'z' && event.shiftKey);
  if (isRedoKey) {
    if (isEditable && !allowInputTargets) {
      log('Redo shortcut ignored due to editable target', { combo: describeKeyCombo(event) });
      return false;
    }
    if (handlers.onRedo) {
      event.preventDefault();
      handlers.onRedo();
      log('Redo shortcut handled', { combo: describeKeyCombo(event) });
      return true;
    }
  }

  if (normalizedKey === 'a' && handlers.onSelectAll) {
    if (isEditable && !allowInputTargets) {
      log('SelectAll shortcut ignored due to editable target', { combo: describeKeyCombo(event) });
      return false;
    }
    event.preventDefault();
    handlers.onSelectAll();
    log('SelectAll shortcut handled', { combo: describeKeyCombo(event) });
    return true;
  }

  return false;
};
