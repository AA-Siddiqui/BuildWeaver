import { FC, useCallback, useEffect, useRef, useState, KeyboardEvent, FormEvent } from 'react';
import { ScopedLogger } from '../../lib/logger';

const logger = new ScopedLogger('AiCommandPalette');

export type LogicBuilderAiSubmitOptions = {
  agentMode: boolean;
};

export interface AiCommandPaletteProps {
  isOpen: boolean;
  isLoading: boolean;
  onSubmit: (prompt: string, options: LogicBuilderAiSubmitOptions) => void;
  onClose: () => void;
}

export const AiCommandPalette: FC<AiCommandPaletteProps> = ({
  isOpen,
  isLoading,
  onSubmit,
  onClose
}) => {
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [agentMode, setAgentMode] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      logger.debug('Command palette opened');
      setPrompt('');
      setError('');
      setAgentMode(true);
      // Delay focus to allow portal to render
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = prompt.trim();
      if (!trimmed) {
        setError('Please describe the logic you want to create.');
        logger.debug('Submit rejected — empty prompt');
        return;
      }
      if (trimmed.length < 3) {
        setError('Prompt must be at least 3 characters.');
        logger.debug('Submit rejected — too short', { length: trimmed.length });
        return;
      }
      logger.info('Submitting prompt', { length: trimmed.length, preview: trimmed.slice(0, 80) });
      setError('');
      onSubmit(trimmed, {
        agentMode
      });
    },
    [agentMode, prompt, onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        logger.debug('Closed via Escape key');
        onClose();
      }
    },
    [onClose]
  );

  const handleBackdropClick = useCallback(() => {
    if (!isLoading) {
      logger.debug('Closed via backdrop click');
      onClose();
    }
  }, [isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      data-testid="ai-command-palette-backdrop"
      onClick={handleBackdropClick}
    >
      {/* Dimmed backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Palette container */}
      <div
        className="relative z-10 w-full max-w-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="AI logic generator"
      >
        <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-white/10 bg-bw-ink shadow-2xl">
          {/* Header */}
          <div className="border-b border-white/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-bw-amber">
              AI Builder
            </p>
          </div>

          {/* Input area */}
          <div className="flex items-center gap-3 px-4 py-3">
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to build or change..."
              disabled={isLoading}
              autoComplete="off"
              className="flex-1 bg-transparent text-sm text-white placeholder-bw-platinum/40 outline-none disabled:opacity-50"
              data-testid="ai-command-input"
            />
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="rounded-lg bg-bw-sand px-4 py-1.5 text-xs font-semibold text-bw-ink transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="ai-command-submit"
            >
              {isLoading ? 'Generating...' : 'Generate'}
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="border-t border-white/5 px-4 py-2">
              <p className="text-xs text-red-400" data-testid="ai-command-error">{error}</p>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="border-t border-white/5 px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-bw-amber border-t-transparent" />
                <p className="text-xs text-bw-platinum/60">AI is generating your changes...</p>
              </div>
            </div>
          )}

          {/* Keyboard hint */}
          <div className="border-t border-white/5 px-4 py-2">
            <div className="mb-2 flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-[11px] text-bw-platinum/70">
                <input
                  type="checkbox"
                  checked={agentMode}
                  onChange={(event) => setAgentMode(event.target.checked)}
                  disabled={isLoading}
                  aria-label="Enable agent mode"
                />
                Agent Mode
              </label>
            </div>
            <p className="text-[10px] text-bw-platinum/30">
              <kbd className="rounded border border-white/10 px-1.5 py-0.5">Enter</kbd> to generate
              <span className="mx-2">|</span>
              <kbd className="rounded border border-white/10 px-1.5 py-0.5">Esc</kbd> to close
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
