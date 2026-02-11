import { NodePreview } from './preview';

interface NodePreviewBubbleProps {
  preview: NodePreview;
}

const stateStyles: Record<NodePreview['state'], string> = {
  ready: 'border-bw-sand text-white',
  unknown: 'border-white/30 text-bw-platinum',
  error: 'border-red-400 text-red-200'
};

export const NodePreviewBubble = ({ preview }: NodePreviewBubbleProps) => {
  const hasQueryPreview =
    (preview.dataShape && preview.dataShape.length > 0) || preview.sql;

  return (
    <div
      className={`absolute right-0 top-full z-50 mt-2 ${hasQueryPreview ? 'w-80' : 'w-60'} rounded-2xl border bg-bw-ink/95 p-3 text-xs shadow-2xl ${stateStyles[preview.state]}`}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Preview</p>
      <p className="mt-1 text-sm font-semibold text-white">{preview.heading}</p>
      <p className="mt-1 text-[13px] text-bw-platinum/80 break-words whitespace-pre-wrap">{preview.summary}</p>

      {preview.dataShape && preview.dataShape.length > 0 && (
        <div className="mt-3 border-t border-white/10 pt-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Data Shape</p>
          <div className="mt-1 max-h-36 space-y-0.5 overflow-y-auto">
            {preview.dataShape.map((col, i) => (
              <div key={`${col.table ?? ''}.${col.name}-${i}`} className="flex justify-between text-[11px]">
                <span className="text-white truncate mr-2">
                  {col.table ? `${col.table}.${col.name}` : col.name}
                </span>
                <span className="text-bw-platinum/60 shrink-0">{col.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {preview.sql && (
        <div className="mt-3 border-t border-white/10 pt-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">SQL</p>
          <pre className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-black/30 p-2 text-[11px] text-green-300 whitespace-pre-wrap break-words font-mono">
            {preview.sql}
          </pre>
        </div>
      )}
    </div>
  );
};
