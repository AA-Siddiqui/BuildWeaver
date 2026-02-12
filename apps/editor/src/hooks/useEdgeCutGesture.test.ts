import { renderHook, act } from '@testing-library/react';
import type { Edge, Node, ReactFlowInstance } from 'reactflow';
import { useEdgeCutGesture } from './useEdgeCutGesture';

// jsdom does not provide PointerEvent — polyfill using MouseEvent
if (typeof globalThis.PointerEvent === 'undefined') {
  (globalThis as Record<string, unknown>).PointerEvent = class PointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? '';
    }
  };
}

jest.mock('../lib/logger', () => ({
  logicLogger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const createWrapper = () => {
  const div = document.createElement('div');
  // Simulate a react-flow pane inside the wrapper
  const pane = document.createElement('div');
  pane.className = 'react-flow__pane';
  div.appendChild(pane);
  div.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ''
  });
  return { div, pane };
};

const createMockReactFlowInstance = (nodes: Node[] = []): ReactFlowInstance =>
  ({
    project: (point: { x: number; y: number }) => point,
    getNodes: () => nodes
  }) as unknown as ReactFlowInstance;

describe('useEdgeCutGesture', () => {
  let wrapperDiv: HTMLDivElement;
  let paneDiv: HTMLDivElement;
  let wrapperRef: { current: HTMLDivElement };

  beforeEach(() => {
    const { div, pane } = createWrapper();
    wrapperDiv = div;
    paneDiv = pane;
    wrapperRef = { current: wrapperDiv };
    document.body.appendChild(wrapperDiv);
  });

  afterEach(() => {
    document.body.removeChild(wrapperDiv);
  });

  it('returns null gesture by default', () => {
    const edges: Edge[] = [];
    const onSever = jest.fn();
    const rfInstance = createMockReactFlowInstance();

    const { result } = renderHook(() =>
      useEdgeCutGesture({
        wrapperRef: wrapperRef as unknown as React.RefObject<HTMLDivElement>,
        reactFlowInstance: rfInstance,
        edges,
        onSever
      })
    );

    expect(result.current.edgeCutGesture).toBeNull();
  });

  it('starts a gesture on Ctrl+pointerdown on the pane', () => {
    const edges: Edge[] = [];
    const onSever = jest.fn();
    const rfInstance = createMockReactFlowInstance();

    const { result } = renderHook(() =>
      useEdgeCutGesture({
        wrapperRef: wrapperRef as unknown as React.RefObject<HTMLDivElement>,
        reactFlowInstance: rfInstance,
        edges,
        onSever
      })
    );

    act(() => {
      const event = new PointerEvent('pointerdown', {
        button: 0,
        ctrlKey: true,
        clientX: 100,
        clientY: 150,
        pointerId: 1,
        bubbles: true
      });
      paneDiv.dispatchEvent(event);
    });

    expect(result.current.edgeCutGesture).not.toBeNull();
    expect(result.current.edgeCutGesture?.startScreen).toEqual({ x: 100, y: 150 });
  });

  it('does not start a gesture without Ctrl key', () => {
    const edges: Edge[] = [];
    const onSever = jest.fn();
    const rfInstance = createMockReactFlowInstance();

    const { result } = renderHook(() =>
      useEdgeCutGesture({
        wrapperRef: wrapperRef as unknown as React.RefObject<HTMLDivElement>,
        reactFlowInstance: rfInstance,
        edges,
        onSever
      })
    );

    act(() => {
      const event = new PointerEvent('pointerdown', {
        button: 0,
        ctrlKey: false,
        clientX: 100,
        clientY: 150,
        pointerId: 1,
        bubbles: true
      });
      paneDiv.dispatchEvent(event);
    });

    expect(result.current.edgeCutGesture).toBeNull();
  });

  it('does not start a gesture when right-clicking', () => {
    const edges: Edge[] = [];
    const onSever = jest.fn();
    const rfInstance = createMockReactFlowInstance();

    const { result } = renderHook(() =>
      useEdgeCutGesture({
        wrapperRef: wrapperRef as unknown as React.RefObject<HTMLDivElement>,
        reactFlowInstance: rfInstance,
        edges,
        onSever
      })
    );

    act(() => {
      const event = new PointerEvent('pointerdown', {
        button: 2,
        ctrlKey: true,
        clientX: 100,
        clientY: 150,
        pointerId: 1,
        bubbles: true
      });
      paneDiv.dispatchEvent(event);
    });

    expect(result.current.edgeCutGesture).toBeNull();
  });

  it('updates the gesture on pointermove', () => {
    const edges: Edge[] = [];
    const onSever = jest.fn();
    const rfInstance = createMockReactFlowInstance();

    const { result } = renderHook(() =>
      useEdgeCutGesture({
        wrapperRef: wrapperRef as unknown as React.RefObject<HTMLDivElement>,
        reactFlowInstance: rfInstance,
        edges,
        onSever
      })
    );

    act(() => {
      paneDiv.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 0,
          ctrlKey: true,
          clientX: 100,
          clientY: 150,
          pointerId: 1,
          bubbles: true
        })
      );
    });

    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 300,
          clientY: 250,
          pointerId: 1,
          bubbles: true
        })
      );
    });

    expect(result.current.edgeCutGesture?.currentScreen).toEqual({ x: 300, y: 250 });
    expect(result.current.edgeCutGesture?.startScreen).toEqual({ x: 100, y: 150 });
  });

  it('severs intersecting edges on pointerup', () => {
    const nodes: Node[] = [
      { id: 'n1', type: 'dummy', position: { x: 0, y: 0 }, data: {}, width: 100, height: 60 },
      { id: 'n2', type: 'dummy', position: { x: 200, y: 0 }, data: {}, width: 100, height: 60 }
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n2' }];
    const onSever = jest.fn();
    const rfInstance = createMockReactFlowInstance(nodes);

    const { result } = renderHook(() =>
      useEdgeCutGesture({
        wrapperRef: wrapperRef as unknown as React.RefObject<HTMLDivElement>,
        reactFlowInstance: rfInstance,
        edges,
        onSever
      })
    );

    // Start at x=150, y=-50 (above the edge center-to-center line)
    act(() => {
      paneDiv.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 0,
          ctrlKey: true,
          clientX: 150,
          clientY: -50,
          pointerId: 1,
          bubbles: true
        })
      );
    });

    // Move to x=150, y=100 (below the edge center-to-center line)
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 150,
          clientY: 100,
          pointerId: 1,
          bubbles: true
        })
      );
    });

    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 150,
          clientY: 100,
          pointerId: 1,
          bubbles: true
        })
      );
    });

    expect(onSever).toHaveBeenCalledWith(['e1']);
    expect(result.current.edgeCutGesture).toBeNull();
  });

  it('cancels when gesture distance is too small', () => {
    const nodes: Node[] = [
      { id: 'n1', type: 'dummy', position: { x: 0, y: 0 }, data: {}, width: 100, height: 60 },
      { id: 'n2', type: 'dummy', position: { x: 200, y: 0 }, data: {}, width: 100, height: 60 }
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n2' }];
    const onSever = jest.fn();
    const rfInstance = createMockReactFlowInstance(nodes);

    renderHook(() =>
      useEdgeCutGesture({
        wrapperRef: wrapperRef as unknown as React.RefObject<HTMLDivElement>,
        reactFlowInstance: rfInstance,
        edges,
        onSever
      })
    );

    // Start and release at almost the same point
    act(() => {
      paneDiv.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 0,
          ctrlKey: true,
          clientX: 150,
          clientY: 30,
          pointerId: 1,
          bubbles: true
        })
      );
    });

    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 152,
          clientY: 31,
          pointerId: 1,
          bubbles: true
        })
      );
    });

    expect(onSever).not.toHaveBeenCalled();
  });

  it('does not sever when gesture misses all edges', () => {
    const nodes: Node[] = [
      { id: 'n1', type: 'dummy', position: { x: 0, y: 0 }, data: {}, width: 100, height: 60 },
      { id: 'n2', type: 'dummy', position: { x: 200, y: 0 }, data: {}, width: 100, height: 60 }
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n2' }];
    const onSever = jest.fn();
    const rfInstance = createMockReactFlowInstance(nodes);

    renderHook(() =>
      useEdgeCutGesture({
        wrapperRef: wrapperRef as unknown as React.RefObject<HTMLDivElement>,
        reactFlowInstance: rfInstance,
        edges,
        onSever
      })
    );

    // Draw a line far from the edge (y=500..600, edge is at y=30)
    act(() => {
      paneDiv.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 0,
          ctrlKey: true,
          clientX: 50,
          clientY: 500,
          pointerId: 1,
          bubbles: true
        })
      );
    });

    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 300,
          clientY: 600,
          pointerId: 1,
          bubbles: true
        })
      );
    });

    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 300,
          clientY: 600,
          pointerId: 1,
          bubbles: true
        })
      );
    });

    expect(onSever).not.toHaveBeenCalled();
  });

  it('calls the logger at each gesture stage', () => {
    const edges: Edge[] = [];
    const onSever = jest.fn();
    const rfInstance = createMockReactFlowInstance();
    const logger = jest.fn();

    renderHook(() =>
      useEdgeCutGesture({
        wrapperRef: wrapperRef as unknown as React.RefObject<HTMLDivElement>,
        reactFlowInstance: rfInstance,
        edges,
        onSever,
        logger
      })
    );

    act(() => {
      paneDiv.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 0,
          ctrlKey: true,
          clientX: 100,
          clientY: 150,
          pointerId: 1,
          bubbles: true
        })
      );
    });

    expect(logger).toHaveBeenCalledWith('Edge cut gesture started', expect.objectContaining({ x: 100, y: 150 }));

    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 102,
          clientY: 151,
          pointerId: 1,
          bubbles: true
        })
      );
    });

    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('cancelled'),
      expect.objectContaining({ distance: expect.any(Number) })
    );
  });

  it('ignores pointermove and pointerup from different pointer ids', () => {
    const edges: Edge[] = [];
    const onSever = jest.fn();
    const rfInstance = createMockReactFlowInstance();

    const { result } = renderHook(() =>
      useEdgeCutGesture({
        wrapperRef: wrapperRef as unknown as React.RefObject<HTMLDivElement>,
        reactFlowInstance: rfInstance,
        edges,
        onSever
      })
    );

    act(() => {
      paneDiv.dispatchEvent(
        new PointerEvent('pointerdown', {
          button: 0,
          ctrlKey: true,
          clientX: 100,
          clientY: 150,
          pointerId: 1,
          bubbles: true
        })
      );
    });

    // Move/up with a different pointerId — should be ignored
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 500,
          clientY: 500,
          pointerId: 99,
          bubbles: true
        })
      );
    });

    // Gesture's current should not have changed
    expect(result.current.edgeCutGesture?.currentScreen).toEqual({ x: 100, y: 150 });

    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 500,
          clientY: 500,
          pointerId: 99,
          bubbles: true
        })
      );
    });

    // Gesture should still be active (not finalized by different pointer)
    expect(result.current.edgeCutGesture).not.toBeNull();
  });
});
