import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Connection,
  Edge,
  Controls,
  EdgeChange,
  MarkerType,
  MiniMap,
  NodeChange,
  NodePositionChange,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  useEdgesState,
  useNodesState,
  useReactFlow
} from 'reactflow';
import type {
  DatabaseConnectionSettings,
  DatabaseField,
  DatabaseFieldType,
  DatabaseRelationship,
  DatabaseSchema,
  DatabaseTable,
  RelationshipCardinality,
  RelationshipModality
} from '@buildweaver/libs';
import { DbTableNode, DbTableNodeData } from './DbTableNode';
import { generateNodeId } from '../logic/nodeFactories';
import { logicLogger } from '../../lib/logger';

const nodeTypes = {
  'db-table': DbTableNode
};

interface DatabaseDesignerModalProps {
  initialSchema: DatabaseSchema;
  onSave: (schema: DatabaseSchema) => Promise<void> | void;
  onApply?: (schema: DatabaseSchema) => Promise<void> | void;
  onLoadFromDatabase?: (connection: DatabaseConnectionSettings, schema: DatabaseSchema) => Promise<DatabaseSchema> | DatabaseSchema;
  onClose: () => void;
}

type RelationshipDraft = {
  sourceTableId: string;
  targetTableId: string;
  cardinality: RelationshipCardinality;
  modality: RelationshipModality;
};

const defaultConnection = (): DatabaseConnectionSettings => ({
  host: 'localhost',
  port: 5432,
  database: '',
  user: '',
  password: '',
  ssl: false
});

const normalizeField = (field: DatabaseField): DatabaseField => ({
  ...field,
  name: field.name?.trim() || 'id',
  type: field.type ?? 'uuid',
  nullable: Boolean(field.nullable),
  unique: Boolean(field.unique),
  defaultValue: field.defaultValue ?? undefined,
  isId: Boolean(field.isId)
});

const normalizeTable = (table: DatabaseTable): DatabaseTable => {
  const ensuredFields = (table.fields ?? []).map((field) => normalizeField(field));
  const hasIdField = ensuredFields.some((field) => field.isId);
  const fields = hasIdField
    ? ensuredFields.map((field) => (field.isId ? { ...field, nullable: false, unique: true } : field))
    : [
        {
          id: `${table.id}-id`,
          name: 'id',
          type: 'uuid' as DatabaseFieldType,
          nullable: false,
          unique: true,
          isId: true
        },
        ...ensuredFields
      ];

  return {
    ...table,
    name: table.name?.trim() || 'Table',
    fields,
    position: table.position ?? { x: 0, y: 0 }
  };
};

const normalizeRelationships = (
  relationships: DatabaseRelationship[] | undefined,
  allowedTableIds: Set<string>
): DatabaseRelationship[] => {
  if (!Array.isArray(relationships)) {
    return [];
  }
  return relationships
    .map((relationship) => {
      if (!allowedTableIds.has(relationship.sourceTableId) || !allowedTableIds.has(relationship.targetTableId)) {
        return null;
      }
      const cardinality: RelationshipCardinality = relationship.cardinality === 'one' ? 'one' : 'many';
      const modality: RelationshipModality = relationship.modality === 1 ? 1 : 0;
      return {
        ...relationship,
        cardinality,
        modality
      } satisfies DatabaseRelationship;
    })
    .filter((relationship): relationship is DatabaseRelationship => Boolean(relationship));
};

const normalizeSchema = (schema: DatabaseSchema): DatabaseSchema => {
  const tables = (schema.tables ?? []).map((table) => normalizeTable(table));
  const tableIds = new Set(tables.map((table) => table.id));
  const relationships = normalizeRelationships(schema.relationships, tableIds);
  const connection = schema.connection ? { ...defaultConnection(), ...schema.connection } : defaultConnection();

  return {
    ...schema,
    name: schema.name?.trim() || 'Database',
    tables,
    relationships,
    connection,
    updatedAt: new Date().toISOString()
  };
};

const buildFlowNodes = (
  tables: DatabaseTable[],
  handlers: Pick<DbTableNodeData, 'onRename' | 'onAddField' | 'onRemoveField' | 'onUpdateField'>
) =>
  tables.map((table, index) => ({
    id: table.id,
    type: 'db-table',
    position: table.position ?? { x: 120 * index, y: 50 * index },
    data: {
      table,
      ...handlers
    }
  }));

const buildFlowEdges = (relationships: DatabaseRelationship[]) =>
  relationships.map<Edge>((relationship) => ({
    id: relationship.id,
    source: relationship.sourceTableId,
    target: relationship.targetTableId,
    label: `${relationship.modality === 0 ? '0' : '1'}..${relationship.cardinality === 'one' ? '1' : 'many'}`,
    style: { stroke: '#DDC57A' },
    labelStyle: { fill: '#DDC57A', fontWeight: 700 },
    markerEnd: { type: MarkerType.ArrowClosed }
  }));

const DesignerCanvas = ({ initialSchema, onSave, onApply, onLoadFromDatabase, onClose }: DatabaseDesignerModalProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();
  const [schema, setSchema] = useState<DatabaseSchema>(() => normalizeSchema(initialSchema));
  const [nodes, setNodes, onNodesChange] = useNodesState<DbTableNodeData>([]);
  const [edges, setEdges] = useEdgesState([]);
  const [pendingRelationship, setPendingRelationship] = useState<RelationshipDraft | null>(null);
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isLoadingFromDb, setIsLoadingFromDb] = useState(false);

  useEffect(() => {
    setSchema(normalizeSchema(initialSchema));
  }, [initialSchema]);

  useEffect(() => {
    setNodes(buildFlowNodes(schema.tables, {
      onRename: (tableId, name) => {
        logicLogger.debug('Database table rename requested', { tableId, name });
        setSchema((current) => ({
          ...current,
          tables: current.tables.map((table) => (table.id === tableId ? { ...table, name } : table))
        }));
      },
      onAddField: (tableId) => {
        const fieldId = `${tableId}-field-${generateNodeId()}`;
        logicLogger.info('Database table field added', { tableId, fieldId });
        setSchema((current) => ({
          ...current,
          tables: current.tables.map((table) =>
            table.id === tableId
              ? {
                  ...table,
                  fields: table.fields.concat({
                    id: fieldId,
                    name: 'new_field',
                    type: 'string' as DatabaseFieldType,
                    defaultValue: '',
                    nullable: true,
                    unique: false
                  })
                }
              : table
          )
        }));
      },
      onRemoveField: (tableId, fieldId) => {
        logicLogger.info('Database table field removed', { tableId, fieldId });
        setSchema((current) => ({
          ...current,
          tables: current.tables.map((table) =>
            table.id === tableId
              ? {
                  ...table,
                  fields: table.fields.filter((field) => field.id !== fieldId || field.isId)
                }
              : table
          )
        }));
      },
      onUpdateField: (tableId, fieldId, patch) => {
        logicLogger.debug('Database table field updated', { tableId, fieldId, patch });
        setSchema((current) => ({
          ...current,
          tables: current.tables.map((table) =>
            table.id === tableId
              ? {
                  ...table,
                  fields: table.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field))
                }
              : table
          )
        }));
      }
    }));
  }, [schema.tables]);

  useEffect(() => {
    setEdges(buildFlowEdges(schema.relationships));
  }, [schema.relationships, setEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const positionChanges = changes.filter(
        (change): change is NodePositionChange => change.type === 'position' && Boolean((change as NodePositionChange).position)
      );
      if (positionChanges.length) {
        logicLogger.debug('Database table positions updated', {
          updatedCount: positionChanges.length,
          tableIds: positionChanges.map((change) => change.id)
        });
        setSchema((current) => ({
          ...current,
          tables: current.tables.map((table) => {
            const positionChange = positionChanges.find((change) => change.id === table.id);
            if (!positionChange || !positionChange.position) {
              return table;
            }
            return { ...table, position: positionChange.position };
          })
        }));
      }
    },
    [onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      const removedIds = changes.filter((change) => change.type === 'remove').map((change) => change.id);
      if (removedIds.length) {
        logicLogger.info('Database relationships removed', { relationshipIds: removedIds });
        setSchema((current) => ({
          ...current,
          relationships: current.relationships.filter((rel) => !removedIds.includes(rel.id))
        }));
      }
    },
    [setEdges]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        logicLogger.warn('Database relationship connection missing endpoints', { connection });
        return;
      }
      logicLogger.info('Database relationship draft created', {
        sourceTableId: connection.source,
        targetTableId: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle
      });
      setPendingRelationship({
        sourceTableId: connection.source,
        targetTableId: connection.target,
        cardinality: 'many',
        modality: 0
      });
    },
    []
  );

  const commitRelationship = useCallback(() => {
    if (!pendingRelationship) {
      return;
    }
    const exists = schema.relationships.some(
      (rel) => rel.sourceTableId === pendingRelationship.sourceTableId && rel.targetTableId === pendingRelationship.targetTableId
    );
    if (exists) {
      setStatus('Relationship already exists between these tables.');
      logicLogger.warn('Database relationship already exists', {
        sourceTableId: pendingRelationship.sourceTableId,
        targetTableId: pendingRelationship.targetTableId
      });
      setPendingRelationship(null);
      return;
    }
    const nextRelationship: DatabaseRelationship = {
      id: `rel-${generateNodeId()}`,
      ...pendingRelationship
    };
    logicLogger.info('Database relationship added', {
      relationshipId: nextRelationship.id,
      sourceTableId: nextRelationship.sourceTableId,
      targetTableId: nextRelationship.targetTableId,
      cardinality: nextRelationship.cardinality,
      modality: nextRelationship.modality
    });
    setSchema((current) => ({
      ...current,
      relationships: current.relationships.concat(nextRelationship)
    }));
    setPendingRelationship(null);
    setStatus('Relationship added.');
    setTimeout(() => setStatus(''), 1500);
  }, [pendingRelationship, schema.relationships]);

  const projectPointer = useCallback(
    (event: DragEvent) => {
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      return reactFlowInstance.project({
        x: event.clientX - (bounds?.left ?? 0),
        y: event.clientY - (bounds?.top ?? 0)
      });
    },
    [reactFlowInstance]
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const position = projectPointer(event);
      const tableId = `table-${generateNodeId()}`;
      logicLogger.info('Database table dropped into canvas', { tableId, position });
      setSchema((current) => ({
        ...current,
        tables: current.tables.concat({
          id: tableId,
          name: `Table ${current.tables.length + 1}`,
          fields: [
            {
              id: `${tableId}-id`,
              name: 'id',
              type: 'uuid' as DatabaseFieldType,
              nullable: false,
              unique: true,
              isId: true
            }
          ],
          position
        })
      }));
    },
    [projectPointer]
  );

  const handleAddTable = useCallback(() => {
    const tableId = `table-${generateNodeId()}`;
    logicLogger.info('Database table added', { tableId });
    setSchema((current) => ({
      ...current,
      tables: current.tables.concat({
        id: tableId,
        name: `Table ${current.tables.length + 1}`,
        fields: [
          {
            id: `${tableId}-id`,
            name: 'id',
            type: 'uuid' as DatabaseFieldType,
            nullable: false,
            unique: true,
            isId: true
          }
        ],
        position: { x: 80 * current.tables.length, y: 60 * current.tables.length }
      })
    }));
  }, []);

  const handleConnectionChange = useCallback(
    (key: keyof DatabaseConnectionSettings, value: string | number | boolean) => {
      logicLogger.debug('Database connection setting updated', { key, value });
      setSchema((current) => ({
        ...current,
        connection: {
          ...(current.connection ?? defaultConnection()),
          [key]: key === 'port' && typeof value === 'string' ? Number(value) || 0 : value
        }
      }));
    },
    []
  );

  const persistSchema = useCallback(
    async (closeAfter?: boolean) => {
      setIsSaving(true);
      const normalized = normalizeSchema(schema);
      try {
        await Promise.resolve(onSave(normalized));
        setStatus('Schema saved');
        logicLogger.info('Database schema saved', {
          schemaId: normalized.id,
          tableCount: normalized.tables.length,
          relationshipCount: normalized.relationships.length
        });
        if (closeAfter) {
          onClose();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to save schema';
        setStatus(message);
        logicLogger.error('Database schema save failed', { schemaId: schema.id, message });
      } finally {
        setIsSaving(false);
        setTimeout(() => setStatus(''), 2000);
      }
    },
    [onClose, onSave, schema]
  );

  const applySchema = useCallback(async () => {
    if (!onApply) {
      setStatus('Apply hook not implemented yet.');
      setTimeout(() => setStatus(''), 2000);
      return;
    }
    setIsApplying(true);
    const normalized = normalizeSchema(schema);
    try {
      await Promise.resolve(onApply(normalized));
      setStatus('Schema applied to database');
      logicLogger.info('Database schema apply requested', {
        schemaId: normalized.id,
        connectionHost: normalized.connection?.host,
        connectionDb: normalized.connection?.database
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to apply schema';
      setStatus(message);
      logicLogger.error('Database schema apply failed', { schemaId: schema.id, message });
    } finally {
      setIsApplying(false);
      setTimeout(() => setStatus(''), 2000);
    }
  }, [onApply, schema]);

  const loadFromDatabase = useCallback(async () => {
    if (!onLoadFromDatabase) {
      setStatus('Load hook not implemented yet.');
      setTimeout(() => setStatus(''), 2000);
      return;
    }
    setIsLoadingFromDb(true);
    const normalized = normalizeSchema(schema);
    const connection = normalized.connection ?? defaultConnection();
    try {
      const loaded = await Promise.resolve(onLoadFromDatabase(connection, normalized));
      const nextSchema = normalizeSchema({ ...loaded, connection });
      setSchema(nextSchema);
      setStatus('Schema loaded from database');
      logicLogger.info('Database schema loaded from database', {
        schemaId: nextSchema.id,
        tableCount: nextSchema.tables.length,
        relationshipCount: nextSchema.relationships.length,
        host: connection.host,
        database: connection.database
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load schema from database';
      setStatus(message);
      logicLogger.error('Database schema load failed', {
        schemaId: normalized.id,
        host: connection.host,
        database: connection.database,
        message
      });
    } finally {
      setIsLoadingFromDb(false);
      setTimeout(() => setStatus(''), 2500);
    }
  }, [onLoadFromDatabase, schema]);

  const connection = useMemo(() => schema.connection ?? defaultConnection(), [schema.connection]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="flex h-full w-full max-w-7xl flex-col rounded-3xl border border-white/10 bg-bw-ink/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 text-white">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-bw-amber">Database designer</p>
            <input
              aria-label="Database name"
              value={schema.name}
              onChange={(event) => setSchema((current) => ({ ...current, name: event.target.value }))}
              className="mt-1 w-72 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-lg font-semibold"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={handleAddTable}
              className="rounded-xl border border-white/20 px-3 py-2 text-white transition hover:-translate-y-0.5"
            >
              Add table
            </button>
            <button
              type="button"
              onClick={() => persistSchema(false)}
              disabled={isSaving}
              className="rounded-xl border border-white/20 px-3 py-2 text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={loadFromDatabase}
              disabled={isLoadingFromDb}
              className="rounded-xl border border-white/20 px-3 py-2 text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {isLoadingFromDb ? 'Loading…' : 'Load from DB'}
            </button>
            <button
              type="button"
              onClick={applySchema}
              disabled={isApplying}
              className="rounded-xl border border-white/20 px-3 py-2 text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {isApplying ? 'Applying…' : 'Apply to DB'}
            </button>
            <button
              type="button"
              onClick={() => persistSchema(true)}
              className="rounded-xl bg-bw-sand px-3 py-2 font-semibold text-bw-ink transition hover:-translate-y-0.5"
            >
              Save & Exit
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/20 px-3 py-2 text-white transition hover:-translate-y-0.5"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="relative flex-1 bg-bw-ink/80" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              fitView
              panOnDrag
              panOnScroll
              zoomOnScroll
              connectionLineStyle={{ stroke: '#F9E7B2', strokeWidth: 2 }}
            >
              <MiniMap pannable zoomable className="!bg-bw-ink/70" />
              <Controls />
              <Background gap={16} color="#ffffff33" />
            </ReactFlow>
            {pendingRelationship && (
              <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-6">
                <div className="pointer-events-auto w-80 rounded-2xl border border-white/10 bg-bw-ink/90 p-4 text-white shadow-xl">
                  <p className="text-sm font-semibold">Configure relationship</p>
                  <p className="text-[11px] text-bw-platinum/70">
                    From {pendingRelationship.sourceTableId} to {pendingRelationship.targetTableId}
                  </p>
                  <div className="mt-3 space-y-2 text-xs">
                    <label className="flex items-center justify-between gap-2">
                      Cardinality (target)
                      <select
                        value={pendingRelationship.cardinality}
                        onChange={(event) =>
                          setPendingRelationship((current) =>
                            current
                              ? { ...current, cardinality: event.target.value as RelationshipCardinality }
                              : current
                          )
                        }
                        className="rounded-lg border border-white/15 bg-white/5 px-2 py-1"
                      >
                        <option value="one">1</option>
                        <option value="many">Many</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      Modality (target)
                      <select
                        value={pendingRelationship.modality}
                        onChange={(event) =>
                          setPendingRelationship((current) =>
                            current ? { ...current, modality: Number(event.target.value) as RelationshipModality } : current
                          )
                        }
                        className="rounded-lg border border-white/15 bg-white/5 px-2 py-1"
                      >
                        <option value={0}>0</option>
                        <option value={1}>1</option>
                      </select>
                    </label>
                    <div className="flex items-center justify-end gap-2 pt-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setPendingRelationship(null)}
                        className="rounded-lg border border-white/20 px-3 py-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={commitRelationship}
                        className="rounded-lg bg-bw-sand px-3 py-1 font-semibold text-bw-ink"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <aside className="w-80 border-l border-white/10 bg-bw-ink/70 p-4 text-sm text-white">
            <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">Postgres connection</p>
            <div className="mt-3 space-y-3">
              <label className="space-y-1">
                <span className="text-[11px] text-bw-platinum/70">Host</span>
                <input
                  value={connection.host}
                  onChange={(event) => handleConnectionChange('host', event.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
                  placeholder="localhost"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-bw-platinum/70">Port</span>
                <input
                  value={connection.port}
                  onChange={(event) => handleConnectionChange('port', event.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
                  placeholder="5432"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-bw-platinum/70">Database</span>
                <input
                  value={connection.database}
                  onChange={(event) => handleConnectionChange('database', event.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
                  placeholder="app_db"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-bw-platinum/70">User</span>
                <input
                  value={connection.user}
                  onChange={(event) => handleConnectionChange('user', event.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
                  placeholder="postgres"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-bw-platinum/70">Password</span>
                <input
                  type="password"
                  value={connection.password}
                  onChange={(event) => handleConnectionChange('password', event.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
                  placeholder="••••••"
                />
              </label>
              <label className="flex items-center gap-2 text-[11px] text-bw-platinum/80">
                <input
                  type="checkbox"
                  checked={Boolean(connection.ssl)}
                  onChange={(event) => handleConnectionChange('ssl', event.target.checked)}
                />
                Require SSL
              </label>
            </div>
            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-bw-platinum/70">
              <p>
                Saving keeps the schema in BuildWeaver. Applying pushes the schema to the configured Postgres database. Many-to-many
                joins should be created by adding explicit join tables.
              </p>
            </div>
            {status && <p className="mt-3 text-[12px] text-bw-sand">{status}</p>}
          </aside>
        </div>
      </div>
    </div>
  );
};

export const DatabaseDesignerModal = (props: DatabaseDesignerModalProps) => (
  <ReactFlowProvider>
    <DesignerCanvas {...props} />
  </ReactFlowProvider>
);
