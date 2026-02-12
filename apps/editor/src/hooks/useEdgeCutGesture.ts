import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, ReactFlowInstance, XYPosition } from 'reactflow';
import { buildNodePositionMap, findEdgesIntersectingSegment } from '../lib/graphInteractions';

type ScreenPoint = { x: number; y: number };

export type EdgeCutGestureState = {
  startFlow: XYPosition;
  currentFlow: XYPosition;
  startScreen: ScreenPoint;
  currentScreen: ScreenPoint;
};

const MIN_GESTURE_DISTANCE = 6;

const gestureDistance = (gesture: EdgeCutGestureState): number =>
  Math.hypot(gesture.currentFlow.x - gesture.startFlow.x, gesture.currentFlow.y - gesture.startFlow.y);

const isPaneTarget = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement && Boolean(target.closest('.react-flow__pane'));

interface UseEdgeCutGestureOptions {
  wrapperRef: RefObject<HTMLDivElement>;
  reactFlowInstance: ReactFlowInstance;
  edges: Edge[];
  onSever: (edgeIds: string[]) => void;
  logger?: (message: string, meta?: Record<string, unknown>) => void;
}

/**
 * Hook that provides Ctrl+LMB drag edge-cutting gesture for any React Flow canvas.
 * Returns the current gesture state for rendering the cut-line overlay.
 */
export const useEdgeCutGesture = ({
  wrapperRef,
  reactFlowInstance,
  edges,
  onSever,
  logger
}: UseEdgeCutGestureOptions) => {
  const log = logger ?? (() => {});
  const [gesture, setGesture] = useState<EdgeCutGestureState | null>(null);
  const gestureRef = useRef<EdgeCutGestureState | null>(null);
  const interactionRef = useRef<number | null>(null);
  const edgesRef = useRef<Edge[]>(edges);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    gestureRef.current = gesture;
  }, [gesture]);

  const projectPointer = useCallback(
    (event: PointerEvent): { screen: ScreenPoint; flow: XYPosition } | null => {
      const bounds = wrapperRef.current?.getBoundingClientRect();
      if (!bounds) {
        log('Unable to project pointer — wrapper bounds unavailable');
        return null;
      }
      const localX = event.clientX - bounds.left;
      const localY = event.clientY - bounds.top;
      const flowPoint = reactFlowInstance.project({ x: localX, y: localY });
      return { screen: { x: localX, y: localY }, flow: flowPoint };
    },
    [log, reactFlowInstance, wrapperRef]
  );

  const beginCutGesture = useCallback(
    (event: PointerEvent) => {
      const projected = projectPointer(event);
      if (!projected) {
        return;
      }
      const state: EdgeCutGestureState = {
        startFlow: projected.flow,
        currentFlow: projected.flow,
        startScreen: projected.screen,
        currentScreen: projected.screen
      };
      interactionRef.current = event.pointerId;
      setGesture(state);
      gestureRef.current = state;
      log('Edge cut gesture started', { x: state.startFlow.x, y: state.startFlow.y });
    },
    [log, projectPointer]
  );

  const updateCutGesture = useCallback(
    (event: PointerEvent) => {
      const projected = projectPointer(event);
      if (!projected) {
        return;
      }
      setGesture((current) => {
        if (!current) {
          return current;
        }
        const next: EdgeCutGestureState = {
          ...current,
          currentFlow: projected.flow,
          currentScreen: projected.screen
        };
        gestureRef.current = next;
        return next;
      });
    },
    [projectPointer]
  );

  const finalizeCutGesture = useCallback(() => {
    const current = gestureRef.current;
    setGesture(null);
    gestureRef.current = null;
    if (!current) {
      return;
    }
    const distance = gestureDistance(current);
    if (distance < MIN_GESTURE_DISTANCE) {
      log('Edge cut gesture cancelled — distance too small', { distance });
      return;
    }
    const nodePositions = buildNodePositionMap(reactFlowInstance.getNodes());
    const intersecting = findEdgesIntersectingSegment(edgesRef.current, nodePositions, {
      start: current.startFlow,
      end: current.currentFlow
    });
    if (intersecting.length === 0) {
      log('Edge cut gesture finished without intersections', { distance });
      return;
    }
    log('Edge cut gesture severing edges', { count: intersecting.length, edgeIds: intersecting });
    onSever(intersecting);
  }, [log, onSever, reactFlowInstance]);

  const handlePanePointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0 || interactionRef.current !== null) {
        return;
      }
      if (!isPaneTarget(event.target)) {
        return;
      }
      if (event.ctrlKey) {
        event.preventDefault();
        event.stopPropagation();
        beginCutGesture(event);
      }
    },
    [beginCutGesture]
  );

  // Attach pointerdown to wrapper element
  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) {
      return;
    }
    element.addEventListener('pointerdown', handlePanePointerDown);
    return () => {
      element.removeEventListener('pointerdown', handlePanePointerDown);
    };
  }, [handlePanePointerDown, wrapperRef]);

  // Attach pointermove / pointerup to window
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (interactionRef.current === null || interactionRef.current !== event.pointerId) {
        return;
      }
      updateCutGesture(event);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (interactionRef.current === null || interactionRef.current !== event.pointerId) {
        return;
      }
      finalizeCutGesture();
      interactionRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [finalizeCutGesture, updateCutGesture]);

  return { edgeCutGesture: gesture };
};
