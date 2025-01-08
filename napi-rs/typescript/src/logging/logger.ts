export class LoggerImpl implements Logger {
  constructor(private options: LoggerOptions = {}) {}

  log(entry: Omit<LogEntry, 'timestamp'>): void {
    const fullEntry: LogEntry = {
      ...entry,
      timestamp: Date.now()
    };
    
    if (this.options.onLog) {
      this.options.onLog(fullEntry);
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: 'debug', message, ...metadata });
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: 'info', message, ...metadata });
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: 'warn', message, ...metadata });
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: 'error', message, ...metadata });
  }
} 