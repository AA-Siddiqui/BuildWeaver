import { useCallback, useEffect, useRef, useState } from 'react';
import { logicLogger } from '../../../lib/logger';

interface TextDraftMetadata {
  nodeId: string;
  field: string;
}

export const useTextDraft = (value: string, metadata: TextDraftMetadata) => {
  const [draft, setDraft] = useState(value);
  const lastSyncedValueRef = useRef(value);

  useEffect(() => {
    if (lastSyncedValueRef.current !== value) {
      logicLogger.debug('Textarea draft synced from node data', {
        nodeId: metadata.nodeId,
        field: metadata.field,
        length: value.length
      });
      lastSyncedValueRef.current = value;
      setDraft(value);
    }
  }, [metadata.field, metadata.nodeId, value]);

  const updateDraft = useCallback((next: string) => {
    setDraft(next);
  }, []);

  return [draft, updateDraft] as const;
};
