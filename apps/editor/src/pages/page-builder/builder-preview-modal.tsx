import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Config, Data } from '@measured/puck';
import { Render } from '@measured/puck';

export type BuilderPreviewViewport = 'desktop' | 'tablet' | 'mobile';

type ViewportPreset = {
  label: string;
  width: number;
  height: number;
  description: string;
};

export const PREVIEW_VIEWPORTS: Record<BuilderPreviewViewport, ViewportPreset> = {
  desktop: {
    label: 'Desktop',
    width: 1920,
    height: 1080,
    description: 'Represents large screens and laptops'
  },
  tablet: {
    label: 'Tablet',
    width: 834,
    height: 1112,
    description: 'Represents portrait tablets'
  },
  mobile: {
    label: 'Mobile',
    width: 390,
    height: 844,
    description: 'Represents modern mobile devices'
  }
};

type BuilderPreviewModalProps = {
  isOpen: boolean;
  mode: BuilderPreviewViewport;
  onModeChange: (mode: BuilderPreviewViewport) => void;
  onClose: () => void;
  config: Config;
  data: Data;
  pageName?: string;
};

export const BuilderPreviewModal = ({
  isOpen,
  mode,
  onModeChange,
  onClose,
  config,
  data,
  pageName
}: BuilderPreviewModalProps) => {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const viewport = useMemo(() => PREVIEW_VIEWPORTS[mode], [mode]);
  const availableWidth = typeof window !== 'undefined' ? window.innerWidth : viewport.width;
  const availableHeight = typeof window !== 'undefined' ? window.innerHeight : viewport.height;

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const content = (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/70 text-white" role="dialog" aria-modal="true">
      <div className="absolute z-[80] w-full bg-gradient-to-b from-black/70 to-transparent  flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">Previewing</p>
          <p className="text-lg font-semibold">{pageName ?? 'Page preview'}</p>
          <p className="text-sm text-white/70">{viewport.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(PREVIEW_VIEWPORTS) as BuilderPreviewViewport[]).map((key) => {
            const preset = PREVIEW_VIEWPORTS[key];
            const isActive = key === mode;
            return (
              <button
                type="button"
                key={key}
                onClick={() => onModeChange(key)}
                className={`rounded-full border px-4 py-2 text-sm transition ${isActive ? 'border-bw-sand bg-bw-sand text-bw-ink' : 'border-white/20 bg-white/10 text-white hover:bg-white/20'}`}
                aria-pressed={isActive}
              >
                {preset.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto">
        <div
          className="shadow-2xl border border-white/10 bg-white"
          style={{
            width: Math.min(viewport.width, availableWidth),
            maxWidth: '100%',
            height: Math.min(viewport.height, availableHeight),
            maxHeight: '100%',
            overflow: 'auto'
          }}
        >
          <Render config={config} data={data} />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
