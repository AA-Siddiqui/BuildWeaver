import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { NodeProps } from 'reactflow';
import type { DatabaseNodeData } from '@buildweaver/libs';
import { DatabaseNode } from './DatabaseNode';

const baseData: DatabaseNodeData = {
  kind: 'database',
  schemaId: 'db-1',
  schemaName: 'Analytics',
  tables: [
    {
      id: 'table-users',
      name: 'Users',
      fields: [
        { id: 'f-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
        { id: 'f-email', name: 'email', type: 'string', nullable: false, unique: true }
      ]
    },
    {
      id: 'table-orders',
      name: 'Orders',
      fields: [
        { id: 'f-order-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
        { id: 'f-total', name: 'total', type: 'number', nullable: false, unique: false }
      ]
    }
  ]
};

const renderNode = (overrides: Partial<DatabaseNodeData> = {}) => {
  const props = {
    data: { ...baseData, ...overrides },
    selected: false
  } as unknown as NodeProps<DatabaseNodeData>;

  return render(<DatabaseNode {...props} />);
};

describe('DatabaseNode', () => {
  it('renders tables and switches selected table details', () => {
    renderNode();

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('table-users');
    expect(screen.getByText('email')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'table-orders' } });

    expect(select).toHaveValue('table-orders');
    expect(screen.getByText('total')).toBeInTheDocument();
    expect(screen.queryByText('email')).toBeNull();
  });

  it('falls back to the first table when selectedTableId is invalid', async () => {
    renderNode({ selectedTableId: 'missing-table' });

    const select = screen.getByRole('combobox');
    await waitFor(() => expect(select).toHaveValue('table-users'));
  });

  it('shows empty state when a table has no fields', () => {
    renderNode({ tables: [{ id: 'table-empty', name: 'Empty', fields: [] }] });

    expect(screen.getByText('No fields defined yet.')).toBeInTheDocument();
  });
});
