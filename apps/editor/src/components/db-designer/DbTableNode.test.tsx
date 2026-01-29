import React from 'react';
import { render } from '@testing-library/react';
import type { DatabaseTable } from '@buildweaver/libs';
import { DbTableNode } from './DbTableNode';

const handleProps: Array<Record<string, unknown>> = [];

jest.mock('reactflow', () => {
  return {
    Handle: (props: Record<string, unknown>) => {
      handleProps.push(props);
      return <div data-testid={`handle-${props.id}`} />;
    },
    Position: { Left: 'left', Right: 'right' },
    __getHandleProps: () => handleProps,
    __resetHandleProps: () => {
      handleProps.length = 0;
    }
  };
});

describe('DbTableNode', () => {
  it('renders left slot as source and right slot as target', () => {
    const table: DatabaseTable = {
      id: 'table-1',
      name: 'Users',
      fields: [{ id: 'id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }],
      position: { x: 0, y: 0 }
    };

    const data = {
      table,
      onRename: jest.fn(),
      onAddField: jest.fn(),
      onRemoveField: jest.fn(),
      onUpdateField: jest.fn()
    };

    const reactflowMock = jest.requireMock('reactflow') as {
      __getHandleProps: () => Array<Record<string, unknown>>;
      __resetHandleProps: () => void;
    };

    reactflowMock.__resetHandleProps();

    render(
      <DbTableNode
        id="table-1"
        data={data}
        type="db-table"
        selected={false}
        dragging={false}
        zIndex={1}
        isConnectable
        xPos={0}
        yPos={0}
      />
    );

    const handles = reactflowMock.__getHandleProps();
    const sourceHandle = handles.find((handle) => handle.id === 'table-1-source');
    const targetHandle = handles.find((handle) => handle.id === 'table-1-target');

    expect(sourceHandle).toBeDefined();
    expect(sourceHandle?.position).toBe('left');
    expect(sourceHandle?.type).toBe('source');

    expect(targetHandle).toBeDefined();
    expect(targetHandle?.position).toBe('right');
    expect(targetHandle?.type).toBe('target');
  });
});
