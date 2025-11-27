import { render, screen, fireEvent } from '@testing-library/react';
import { Position, ReactFlowProvider } from 'reactflow';

jest.mock('reactflow', () => {
  const actual = jest.requireActual('reactflow');
  const React = jest.requireActual('react');
  return {
    ...actual,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
  };
});
import { SeverableEdge } from './SeverableEdge';
import { LogicEdgeActionsProvider } from './LogicEdgeActionsContext';

const baseProps = {
  id: 'edge-test',
  source: 'a',
  target: 'b',
  sourceX: 0,
  sourceY: 0,
  targetX: 120,
  targetY: 0,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  interactionWidth: 5
};

describe('SeverableEdge', () => {
  it('severs the edge when the hover button is clicked', () => {
    const severEdge = jest.fn();
    render(
      <ReactFlowProvider>
        <div className="react-flow">
          <svg>
            <LogicEdgeActionsProvider value={{ severEdge }}>
              <SeverableEdge {...baseProps} />
            </LogicEdgeActionsProvider>
          </svg>
          <div className="react-flow__edge-labels" />
        </div>
      </ReactFlowProvider>
    );

    const wrapper = screen.getByTestId('edge-wrapper-edge-test');
    fireEvent.mouseEnter(wrapper);
    const button = screen.getByRole('button', { name: /sever connection/i });
    fireEvent.click(button);

    expect(severEdge).toHaveBeenCalledWith('edge-test', { reason: 'hover-button' });
  });
});
