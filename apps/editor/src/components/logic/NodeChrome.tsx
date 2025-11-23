import { ReactNode, useState } from 'react';
import { NodePreview } from './preview';
import { NodePreviewBubble } from './NodePreviewBubble';

interface NodeChromeProps {
  badge: string;
  label: string;
  description?: string;
  preview: NodePreview;
  children: ReactNode;
}

export const NodeChrome = ({ badge, label, description, preview, children }: NodeChromeProps) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="w-56 rounded-2xl border border-white/10 bg-bw-ink/70 p-4 text-xs text-white shadow-xl backdrop-blur">
        <p className="text-[10px] uppercase tracking-[0.3em] text-bw-amber">{badge}</p>
        <p className="mt-1 text-lg font-semibold text-white">{label}</p>
        {description && <p className="text-[11px] text-bw-platinum/70">{description}</p>}
        <div className="mt-3 space-y-2 text-xs text-bw-platinum">{children}</div>
      </div>
      {hovered && <NodePreviewBubble preview={preview} />}
    </div>
  );
};
