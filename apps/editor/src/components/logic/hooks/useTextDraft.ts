import { useCallback, useEffect, useRef, useState } from 'react';
import { logicLogger } from '../../../lib/logger';

interface TextDraftMetadata {
  nodeId: string;
  field: string;
}

interface TextDraftOptions {
  preserveLocalEdits?: boolean;
}

export const useTextDraft = (value: string, metadata: TextDraftMetadata, options: TextDraftOptions = {}) => {
  const [draft, setDraft] = useState(value);
  const lastSyncedValueRef = useRef(value);
  const skipSyncRef = useRef(false);
  const preserveLocalEdits = options.preserveLocalEdits ?? false;

  useEffect(() => {
    if (lastSyncedValueRef.current === value) {
      return;
    }

    if (preserveLocalEdits && skipSyncRef.current) {
      logicLogger.debug('Textarea draft sync skipped to preserve user input', {
        nodeId: metadata.nodeId,
        field: metadata.field,
        incomingLength: value.length
      });
      skipSyncRef.current = false;
      lastSyncedValueRef.current = value;
      return;
    }

    logicLogger.debug('Textarea draft synced from node data', {
      nodeId: metadata.nodeId,
      field: metadata.field,
      length: value.length
    });
    lastSyncedValueRef.current = value;
    setDraft(value);
  }, [metadata.field, metadata.nodeId, preserveLocalEdits, value]);

  const updateDraft = useCallback((next: string) => {
    if (preserveLocalEdits) {
      skipSyncRef.current = true;
    }
    setDraft(next);
  }, [preserveLocalEdits]);

  return [draft, updateDraft] as const;
};
