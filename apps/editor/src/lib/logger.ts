type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const logMethodMap: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

const formatPayload = (scope: string, message: string, meta?: Record<string, unknown>) => {
  if (meta && Object.keys(meta).length > 0) {
    return [`[${scope}] ${message}`, meta];
  }
  return [`[${scope}] ${message}`];
};

export class ScopedLogger {
  constructor(private readonly scope: string) {}

  log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const method = logMethodMap[level] ?? console.log;
    method(...formatPayload(this.scope, message, meta));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log('error', message, meta);
  }
}

export const logicLogger = new ScopedLogger('LogicEditor');
export const dbDesignerLogger = new ScopedLogger('DbDesigner');
export const queryEditorLogger = new ScopedLogger('QueryEditor');
