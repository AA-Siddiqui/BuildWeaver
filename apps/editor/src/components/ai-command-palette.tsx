import { useCallback, useEffect, useRef, useState, type FC, type KeyboardEvent } from 'react';

const LOG_PREFIX = '[AiCommandPalette]';

const logPaletteEvent = (message: string, details?: Record<string, unknown>) => {
  if (typeof console !== 'undefined') {
    console.info(`${LOG_PREFIX} ${message}`, details ?? '');
  }
};

export type PageBuilderAiSubmitOptions = {
  agentMode: boolean;
};

export type AiCommandPaletteProps = {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (prompt: string, options: PageBuilderAiSubmitOptions) => void;
};

export const AiCommandPalette: FC<AiCommandPaletteProps> = ({
  open,
  loading,
  onClose,
  onSubmit
}) => {
  const [prompt, setPrompt] = useState('');
  const [agentMode, setAgentMode] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      logPaletteEvent('Palette opened');
      setPrompt('');
      setAgentMode(true);
      // Delay focus slightly to ensure DOM is ready
      const handle = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(handle);
    } else {
      logPaletteEvent('Palette closed');
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        logPaletteEvent('Dismissed via Escape key');
        onClose();
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const trimmed = prompt.trim();
        if (!trimmed || loading) {
          logPaletteEvent('Submit ignored', {
            reason: !trimmed ? 'empty prompt' : 'loading in progress'
          });
          return;
        }
        logPaletteEvent('Submitting prompt', { promptLength: trimmed.length });
        onSubmit(trimmed, {
          agentMode
        });
      }
    },
    [agentMode, loading, onClose, onSubmit, prompt]
  );

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
      role="dialog"
      aria-modal="true"
      aria-label="AI command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          if (!loading) {
            logPaletteEvent('Dismissed via backdrop click');
            onClose();
          }
        }}
      />

      {/* Palette */}
      <div className="relative w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-sm font-medium text-bw-amber">AI</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
            placeholder="Describe what you want to build or change..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            maxLength={2000}
            autoComplete="off"
            aria-label="AI prompt input"
          />
          {loading ? (
            <span className="text-xs text-gray-400 animate-pulse">Generating...</span>
          ) : (
            <kbd className="hidden sm:inline-block rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[0.65rem] text-gray-400">
              Enter
            </kbd>
          )}
        </div>
        {loading && (
          <div className="border-t border-gray-100 px-4 py-2">
            <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full w-1/3 animate-shimmer rounded-full bg-bw-sand" />
            </div>
          </div>
        )}
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={agentMode}
                onChange={(event) => setAgentMode(event.target.checked)}
                disabled={loading}
                aria-label="Enable agent mode"
              />
              Agent Mode
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
