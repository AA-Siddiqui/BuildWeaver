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
  return (
    <div
      className={`absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border bg-bw-ink/95 p-3 text-xs shadow-2xl ${stateStyles[preview.state]}`}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-bw-amber">Preview</p>
      <p className="mt-1 text-sm font-semibold text-white">{preview.heading}</p>
      <p className="mt-1 text-[13px] text-bw-platinum/80 break-words whitespace-pre-wrap">{preview.summary}</p>
    </div>
  );
};
