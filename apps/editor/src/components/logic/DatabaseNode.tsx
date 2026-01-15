import { useEffect, useMemo, useState } from 'react';
import type { NodeProps } from 'reactflow';
import type { DatabaseNodeData } from '@buildweaver/libs';
import { NodeChrome } from './NodeChrome';
import type { NodePreview } from './preview';

export const DatabaseNode = ({ data }: NodeProps<DatabaseNodeData>) => {
  const [selectedTableId, setSelectedTableId] = useState<string | undefined>(data.selectedTableId ?? data.tables[0]?.id);

  useEffect(() => {
    if (selectedTableId && data.tables.some((table) => table.id === selectedTableId)) {
      return;
    }
    setSelectedTableId(data.tables[0]?.id);
  }, [data.tables, selectedTableId]);

  const selectedTable = useMemo(() => data.tables.find((table) => table.id === selectedTableId), [data.tables, selectedTableId]);

  const preview: NodePreview = useMemo(
    () => ({
      state: 'ready',
      heading: data.schemaName,
      summary: `${data.tables.length} table${data.tables.length === 1 ? '' : 's'}`
    }),
    [data.schemaName, data.tables.length]
  );

  return (
    <NodeChrome badge="Database" label={data.schemaName} description="Schema snapshot" preview={preview}>
      <label className="flex flex-col gap-1 text-xs text-bw-platinum">
        <span className="text-[11px] uppercase tracking-[0.2em] text-bw-amber">Tables</span>
        <select
          value={selectedTableId}
          onChange={(event) => setSelectedTableId(event.target.value)}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white"
        >
          {data.tables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.name}
            </option>
          ))}
        </select>
      </label>
      {selectedTable ? (
        <div className="mt-2 space-y-1 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-bw-platinum/80">
          {selectedTable.fields.map((field) => (
            <div key={field.id} className="flex items-center justify-between">
              <div>
                <p className="text-white">{field.name}</p>
                <p className="text-[10px] uppercase tracking-[0.1em] text-bw-amber">{field.type}</p>
              </div>
              <div className="text-[10px] text-bw-platinum/60">
                {field.isId ? 'Primary' : ''}
                {field.unique && !field.isId ? 'Unique' : ''}
                {field.nullable ? '' : ' • Not null'}
              </div>
            </div>
          ))}
          {!selectedTable.fields.length && <p>No fields defined yet.</p>}
        </div>
      ) : (
        <p className="text-[11px] text-bw-platinum/70">Add tables in the DB designer.</p>
      )}
    </NodeChrome>
  );
};
