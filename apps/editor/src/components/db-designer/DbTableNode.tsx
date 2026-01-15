import { ChangeEvent } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import type { DatabaseField, DatabaseFieldType, DatabaseTable } from '@buildweaver/libs';

export interface DbTableNodeData {
  table: DatabaseTable;
  onRename: (tableId: string, name: string) => void;
  onAddField: (tableId: string) => void;
  onRemoveField: (tableId: string, fieldId: string) => void;
  onUpdateField: (tableId: string, fieldId: string, patch: Partial<DatabaseField>) => void;
}

const FIELD_TYPES: DatabaseFieldType[] = ['uuid', 'string', 'number', 'boolean', 'json', 'date', 'datetime'];

const toTitle = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const DbTableNode = ({ data, id }: NodeProps<DbTableNodeData>) => {
  if (!data?.table) {
    return null;
  }

  const { table } = data;

  const handleFieldChange = (fieldId: string, patch: Partial<DatabaseField>) => {
    data.onUpdateField(table.id, fieldId, patch);
  };

  const handleTableRename = (event: ChangeEvent<HTMLInputElement>) => {
    data.onRename(table.id, event.target.value);
  };

  return (
    <div className="w-80 rounded-2xl border border-white/10 bg-bw-ink/80 p-4 text-white shadow-xl">
      <Handle type="target" position={Position.Left} id={`${id}-target`} style={{ background: '#D34E4E' }} />
      <Handle type="source" position={Position.Right} id={`${id}-source`} style={{ background: '#DDC57A' }} />
      <div className="mb-3 flex items-center justify-between gap-2">
        <input
          aria-label="Table name"
          value={table.name}
          onChange={handleTableRename}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-bw-sand"
        />
        <button
          type="button"
          onClick={() => data.onAddField(table.id)}
          className="rounded-lg border border-white/20 px-2 py-1 text-[11px] font-semibold text-white"
        >
          + Field
        </button>
      </div>
      <div className="space-y-2">
        {table.fields.map((field) => (
          <div key={field.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2">
              <input
                aria-label={`${field.name}-name`}
                value={field.name}
                onChange={(event) => handleFieldChange(field.id, { name: event.target.value })}
                className="w-32 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs"
                disabled={field.isId}
              />
              <select
                aria-label={`${field.name}-type`}
                value={field.type}
                onChange={(event) => handleFieldChange(field.id, { type: event.target.value as DatabaseFieldType })}
                className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs"
              >
                {FIELD_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {toTitle(option)}
                  </option>
                ))}
              </select>
              <input
                aria-label={`${field.name}-default`}
                value={field.defaultValue ?? ''}
                onChange={(event) => handleFieldChange(field.id, { defaultValue: event.target.value })}
                placeholder="Default"
                className="w-24 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs"
              />
              <label className="flex items-center gap-1 text-[11px] text-bw-platinum/80">
                <input
                  type="checkbox"
                  checked={field.nullable}
                  onChange={(event) => handleFieldChange(field.id, { nullable: event.target.checked })}
                  aria-label={`${field.name}-nullable`}
                />
                Null
              </label>
              <label className="flex items-center gap-1 text-[11px] text-bw-platinum/80">
                <input
                  type="checkbox"
                  checked={field.unique}
                  onChange={(event) => handleFieldChange(field.id, { unique: event.target.checked })}
                  aria-label={`${field.name}-unique`}
                />
                Unique
              </label>
              {!field.isId && (
                <button
                  type="button"
                  onClick={() => data.onRemoveField(table.id, field.id)}
                  className="ml-auto text-[11px] text-red-300"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        {!table.fields.length && <p className="text-xs text-bw-platinum/70">Add fields to describe this table.</p>}
      </div>
    </div>
  );
};
