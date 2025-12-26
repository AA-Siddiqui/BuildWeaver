import { useCallback, useState } from 'react';
import { logicLogger, ScopedLogger } from '../lib/logger';

type LoggerLike = Pick<ScopedLogger, 'info' | 'debug'>;

type UseNodePaletteVisibilityOptions = {
  projectId?: string;
  initialVisible?: boolean;
  logger?: LoggerLike;
};

type VisibilitySource = string;

export const useNodePaletteVisibility = ({
  projectId,
  initialVisible = true,
  logger = logicLogger
}: UseNodePaletteVisibilityOptions = {}) => {
  const [isVisible, setIsVisible] = useState(initialVisible);

  const logVisibilityChange = useCallback(
    (visible: boolean, source: VisibilitySource) => {
      logger.info('Node palette visibility changed', {
        projectId,
        visible,
        source
      });
    },
    [logger, projectId]
  );

  const toggle = useCallback(
    (source: VisibilitySource = 'toggle') => {
      setIsVisible((current) => {
        const next = !current;
        logVisibilityChange(next, source);
        return next;
      });
    },
    [logVisibilityChange]
  );

  const show = useCallback(
    (source: VisibilitySource = 'show') => {
      setIsVisible((current) => {
        if (current) {
          logger.debug('Node palette already visible', { projectId, source });
          return current;
        }
        logVisibilityChange(true, source);
        return true;
      });
    },
    [logVisibilityChange, logger, projectId]
  );

  const hide = useCallback(
    (source: VisibilitySource = 'hide') => {
      setIsVisible((current) => {
        if (!current) {
          logger.debug('Node palette already hidden', { projectId, source });
          return current;
        }
        logVisibilityChange(false, source);
        return false;
      });
    },
    [logVisibilityChange, logger, projectId]
  );

  return { isVisible, toggle, show, hide };
};