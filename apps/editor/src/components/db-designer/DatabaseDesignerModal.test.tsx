import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DatabaseSchema } from '@buildweaver/libs';
import { DatabaseDesignerModal } from './DatabaseDesignerModal';
import type { DbDesignerSnapshot } from './DatabaseDesignerModal';
import { SnapshotHistory } from '../../lib/snapshotHistory';

jest.mock('../../lib/logger', () => ({
  dbDesignerLogger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock('../../lib/editorShortcuts', () => ({
  processEditorShortcut: jest.fn()
}));

jest.mock('../../hooks/useDeleteNodesShortcut', () => ({
  useDeleteNodesShortcut: jest.fn().mockReturnValue(jest.fn())
}));

jest.mock('../../lib/snapshotHistory', () => ({
  SnapshotHistory: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    undo: jest.fn().mockReturnValue(null),
    redo: jest.fn().mockReturnValue(null),
    reset: jest.fn(),
    suppressNextDiff: jest.fn(),
    getUndoDepth: jest.fn().mockReturnValue(0),
    getRedoDepth: jest.fn().mockReturnValue(0)
  }))
}));

jest.mock('reactflow', () => {
  return {
    Background: ({ children }: { children?: React.ReactNode }) => <div data-testid="background">{children}</div>,
    Controls: ({ children }: { children?: React.ReactNode }) => <div data-testid="controls">{children}</div>,
    MiniMap: ({ children }: { children?: React.ReactNode }) => <div data-testid="minimap">{children}</div>,
    ReactFlowProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    ReactFlow: ({ children }: { children?: React.ReactNode }) => <div data-testid="reactflow">{children}</div>,
    MarkerType: { ArrowClosed: 'ArrowClosed' },
    Handle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Position: { Left: 'left', Right: 'right' },
    useReactFlow: () => ({ project: (point: unknown) => point }),
    useNodesState: (initial: unknown[] = []) => {
      const [nodes, setNodes] = React.useState(initial);
      const onChange = () => setNodes(nodes);
      return [nodes, setNodes, onChange] as const;
    },
    useEdgesState: (initial: unknown[] = []) => {
      const [edges, setEdges] = React.useState(initial);
      const onChange = () => setEdges(edges);
      return [edges, setEdges, onChange] as const;
    },
    applyEdgeChanges: (_changes: unknown, edges: unknown) => edges
  };
});

const baseSchema: DatabaseSchema = {
  id: 'db-1',
  name: 'Demo DB',
  tables: [
    {
      id: 'table-1',
      name: 'Users',
      fields: [{ id: 'id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }],
      position: { x: 0, y: 0 }
    }
  ],
  relationships: [],
  connection: undefined
};

describe('DatabaseDesignerModal', () => {
  it('saves normalized schema with id field and default connection', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const schemaWithoutId: DatabaseSchema = {
      ...baseSchema,
      tables: [
        {
          id: 'table-1',
          name: 'Users',
          fields: [{ id: 'email', name: 'email', type: 'string', nullable: false, unique: true }],
          position: { x: 0, y: 0 }
        }
      ],
      connection: undefined
    };

    render(<DatabaseDesignerModal initialSchema={schemaWithoutId} onSave={onSave} onClose={jest.fn()} />);

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0] as DatabaseSchema;

    const idField = saved.tables[0].fields.find((field) => field.isId);
    expect(idField).toBeDefined();
    expect(idField?.nullable).toBe(false);
    expect(idField?.unique).toBe(true);
    expect(saved.connection?.host).toBe('localhost');
    expect(saved.connection?.port).toBe(5432);
    expect(typeof saved.updatedAt).toBe('string');
  });

  it('applies schema with updated connection settings', async () => {
    const onApply = jest.fn().mockResolvedValue(undefined);

    render(
      <DatabaseDesignerModal
        initialSchema={baseSchema}
        onSave={jest.fn()}
        onApply={onApply}
        onClose={jest.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('localhost'), { target: { value: 'db.internal' } });
    fireEvent.change(screen.getByPlaceholderText('5432'), { target: { value: '6000' } });
    fireEvent.change(screen.getByPlaceholderText('app_db'), { target: { value: 'app' } });
    fireEvent.change(screen.getByPlaceholderText('postgres'), { target: { value: 'pguser' } });
    fireEvent.change(screen.getByPlaceholderText('••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByLabelText('Require SSL'));

    fireEvent.click(screen.getByText('Apply to DB'));

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    const applied = onApply.mock.calls[0][0] as DatabaseSchema;

    expect(applied.connection?.host).toBe('db.internal');
    expect(applied.connection?.port).toBe(6000);
    expect(applied.connection?.database).toBe('app');
    expect(applied.connection?.user).toBe('pguser');
    expect(applied.connection?.password).toBe('secret');
    expect(applied.connection?.ssl).toBe(true);
    expect(screen.getByText('Schema applied to database')).toBeInTheDocument();
  });

  it('surfaces apply errors to the user', async () => {
    const onApply = jest.fn().mockRejectedValue(new Error('connection refused'));

    render(
      <DatabaseDesignerModal
        initialSchema={baseSchema}
        onSave={jest.fn()}
        onApply={onApply}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText('Apply to DB'));

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(screen.getByText('connection refused')).toBeInTheDocument();
  });

  it('surfaces load errors to the user', async () => {
    const onLoadFromDatabase = jest.fn().mockRejectedValue(new Error('authentication failed'));

    render(
      <DatabaseDesignerModal
        initialSchema={baseSchema}
        onSave={jest.fn()}
        onLoadFromDatabase={onLoadFromDatabase}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText('Load from DB'));

    await waitFor(() => expect(onLoadFromDatabase).toHaveBeenCalledTimes(1));
    expect(screen.getByText('authentication failed')).toBeInTheDocument();
  });

  it('adds a new table before saving', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(<DatabaseDesignerModal initialSchema={baseSchema} onSave={onSave} onClose={jest.fn()} />);

    fireEvent.click(screen.getByText('Add table'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0] as DatabaseSchema;

    expect(saved.tables.length).toBeGreaterThan(baseSchema.tables.length);
    const newestTable = saved.tables[saved.tables.length - 1];
    const idField = newestTable.fields.find((field) => field.isId);
    expect(idField).toBeDefined();
    expect(idField?.nullable).toBe(false);
  });

  it('loads schema from database and updates state before saving', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const loadedSchema: DatabaseSchema = {
      ...baseSchema,
      id: 'db-remote',
      name: 'Remote',
      tables: [
        ...baseSchema.tables,
        {
          id: 'orders',
          name: 'Orders',
          fields: [
            { id: 'orders-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
            { id: 'orders-total', name: 'total', type: 'number', nullable: false, unique: false }
          ],
          position: { x: 120, y: 80 }
        }
      ]
    };

    const onLoadFromDatabase = jest.fn().mockResolvedValue(loadedSchema);

    render(
      <DatabaseDesignerModal
        initialSchema={baseSchema}
        onSave={onSave}
        onLoadFromDatabase={onLoadFromDatabase}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText('Load from DB'));

    await waitFor(() => expect(onLoadFromDatabase).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Schema loaded from database')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0] as DatabaseSchema;

    expect(saved.tables.find((table) => table.name === 'Orders')).toBeDefined();
  });
});

// -- DB Designer SnapshotHistory tests --
// Use the real SnapshotHistory for these tests (the mock above is only for render tests)
const { SnapshotHistory: RealSnapshotHistory } = jest.requireActual<typeof import('../../lib/snapshotHistory')>('../../lib/snapshotHistory');

const cloneSnap = (snap: DbDesignerSnapshot): DbDesignerSnapshot =>
  JSON.parse(JSON.stringify(snap));

const hashSnap = (snap: DbDesignerSnapshot): string =>
  JSON.stringify({ t: snap.tables, r: snap.relationships, n: snap.name });

const makeSnap = (overrides: Partial<DbDesignerSnapshot> = {}): DbDesignerSnapshot => ({
  tables: [],
  relationships: [],
  name: 'Test DB',
  ...overrides
});

describe('DbDesigner SnapshotHistory', () => {
  let history: SnapshotHistory<DbDesignerSnapshot>;

  beforeEach(() => {
    history = new RealSnapshotHistory<DbDesignerSnapshot>({
      clone: cloneSnap,
      hash: hashSnap,
      limit: 50
    });
  });

  it('records a snapshot when schema changes', () => {
    history.observe(makeSnap({ name: 'DB1' }));
    history.observe(makeSnap({ name: 'DB2' }));
    expect(history.getUndoDepth()).toBe(1);
  });

  it('does not record if hash is unchanged', () => {
    history.observe(makeSnap({ name: 'DB1' }));
    history.observe(makeSnap({ name: 'DB1' }));
    expect(history.getUndoDepth()).toBe(0);
  });

  it('supports undo to restore previous schema state', () => {
    history.observe(makeSnap({ name: 'DB1', tables: [{ id: 't1', name: 'users', fields: [], position: { x: 0, y: 0 } }] }));
    history.observe(makeSnap({ name: 'DB2', tables: [] }));

    const restored = history.undo(makeSnap({ name: 'DB2', tables: [] }));
    expect(restored).not.toBeNull();
    expect(restored!.name).toBe('DB1');
    expect(restored!.tables).toHaveLength(1);
  });

  it('supports redo after undo', () => {
    history.observe(makeSnap({ name: 'DB1' }));
    history.observe(makeSnap({ name: 'DB2' }));
    history.observe(makeSnap({ name: 'DB3' }));

    const afterUndo = history.undo(makeSnap({ name: 'DB3' }));
    expect(afterUndo!.name).toBe('DB2');

    const afterRedo = history.redo(afterUndo!);
    expect(afterRedo!.name).toBe('DB3');
  });

  it('returns null when no undo or redo available', () => {
    history.observe(makeSnap());
    expect(history.undo(makeSnap())).toBeNull();
    expect(history.redo(makeSnap())).toBeNull();
  });

  it('suppresses next diff after restoration', () => {
    history.observe(makeSnap({ name: 'DB1' }));
    history.observe(makeSnap({ name: 'DB2' }));

    history.suppressNextDiff();
    history.observe(makeSnap({ name: 'DB1' }));
    expect(history.getUndoDepth()).toBe(1);
  });

  it('resets history when schema is loaded from database', () => {
    history.observe(makeSnap({ name: 'DB1' }));
    history.observe(makeSnap({ name: 'DB2' }));

    history.reset(makeSnap({ name: 'Loaded' }));
    expect(history.getUndoDepth()).toBe(0);
    expect(history.getRedoDepth()).toBe(0);
  });

  it('clones snapshots to prevent mutation', () => {
    history.observe(makeSnap({ tables: [{ id: 't1', name: 'users', fields: [], position: { x: 0, y: 0 } }] }));
    history.observe(makeSnap({ tables: [{ id: 't1', name: 'modified', fields: [], position: { x: 0, y: 0 } }] }));

    const restored = history.undo(makeSnap({ tables: [{ id: 't1', name: 'modified', fields: [], position: { x: 0, y: 0 } }] }));
    expect(restored!.tables[0].name).toBe('users');

    restored!.tables[0].name = 'hacked';
    const afterRedo = history.redo(restored!);
    expect(afterRedo!.tables[0].name).toBe('modified');
  });

  it('tracks relationships in snapshots', () => {
    history.observe(makeSnap({
      relationships: [{ id: 'r1', sourceTableId: 't1', targetTableId: 't2', cardinality: 'many', modality: 0 }]
    }));
    history.observe(makeSnap({ relationships: [] }));

    const restored = history.undo(makeSnap({ relationships: [] }));
    expect(restored!.relationships).toHaveLength(1);
    expect(restored!.relationships[0].id).toBe('r1');
  });
});
