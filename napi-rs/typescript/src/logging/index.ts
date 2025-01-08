import { Logger, LogEntry, Request, Response } from '../types';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LoggerOptions {
  level?: LogLevel;
  format?: (entry: LogEntry) => string;
  transport?: (formatted: string) => void;
}

export class RouterLogger implements Logger {
  private level: LogLevel;
  private format: (entry: LogEntry) => string;
  private transport: (formatted: string) => void;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || LogLevel.INFO;
    this.format = options.format || this.defaultFormat;
    this.transport = options.transport || console.log;
  }

  private defaultFormat(entry: LogEntry): string {
    const timestamp = new Date().toISOString();
    const { level, message, ...meta } = entry;
    return `${timestamp} [${level.toUpperCase()}] ${message} ${JSON.stringify(meta)}`;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
    if (this.shouldLog(level)) {
      const entry: LogEntry = {
        level,
        message,
        timestamp: Date.now(),
        ...meta
      };
      const formatted = this.format(entry);
      this.transport(formatted);
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, meta);
  }
}

export function createLogger(options?: LoggerOptions): Logger {
  return new RouterLogger(options);
}

export function createRequestLogger(logger: Logger) {
  return async (req: Request, next: () => Promise<Response>): Promise<Response> => {
    const startTime = Date.now();
    
    try {
      const response = await next();
      const duration = Date.now() - startTime;
      
      logger.info('Request completed', {
        method: req.method,
        path: req.path,
        status: response.status,
        duration,
      });
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Request failed', {
        method: req.method,
        path: req.path,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });
      
      throw error;
    }
  };
}

export function createErrorLogger(logger: Logger) {
  return (error: Error): void => {
    logger.error('Unhandled error', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  };
}

// Utility functions for creating specialized loggers
export function createAccessLogger(options?: LoggerOptions): Logger {
  return createLogger({
    ...options,
    format: (entry) => {
      const timestamp = new Date().toISOString();
      const { method, path, status, duration } = entry;
      return `${timestamp} ${method} ${path} ${status} ${duration}ms`;
    },
  });
}

export function createErrorLoggerWithFormat(options?: LoggerOptions): Logger {
  return createLogger({
    ...options,
    level: LogLevel.ERROR,
    format: (entry) => {
      const timestamp = new Date().toISOString();
      const { name, message, stack } = entry;
      return `${timestamp} [ERROR] ${name}: ${message}\n${stack || ''}`;
    },
  });
}

export { Logger }; 