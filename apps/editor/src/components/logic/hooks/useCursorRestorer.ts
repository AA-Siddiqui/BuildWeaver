import { useCallback, useEffect, useRef } from 'react';
import { logicLogger } from '../../../lib/logger';

interface CursorMetadata {
  nodeId?: string;
  field?: string;
  role?: string;
}

type CursorTarget = HTMLInputElement | HTMLTextAreaElement;

const isCursorTarget = (target: EventTarget | null): target is CursorTarget => {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
};

/**
 * Restores cursor/selection position for controlled ReactFlow node inputs so edits don't jump to the end.
 */
export const useCursorRestorer = () => {
  const rafRef = useRef<number | null>(null);
  const warnedTargetsRef = useRef(new Set<string>());

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return useCallback(
    (target: EventTarget | null, metadata?: CursorMetadata) => {
      if (!isCursorTarget(target)) {
        return;
      }

      const selectionStart = target.selectionStart;
      const selectionEnd = target.selectionEnd;
      const key = `${metadata?.nodeId ?? 'unknown'}:${metadata?.field ?? target.name ?? target.id ?? 'input'}`;

      if (selectionStart === null || selectionEnd === null) {
        if (!warnedTargetsRef.current.has(key)) {
          warnedTargetsRef.current.add(key);
          logicLogger.debug('Cursor preservation unavailable for input', {
            ...metadata,
            tagName: target.tagName,
            valueLength: target.value.length
          });
        }
        return;
      }

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        if (document.activeElement !== target) {
          return;
        }
        try {
          target.setSelectionRange(selectionStart, selectionEnd);
        } catch (error) {
          logicLogger.warn('Failed to restore cursor selection', {
            ...metadata,
            tagName: target.tagName,
            message: error instanceof Error ? error.message : String(error)
          });
        }
      });
    },
    []
  );
};
