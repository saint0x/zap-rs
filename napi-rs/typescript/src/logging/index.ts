import { Logger, LogEntry, JsRequest as Request, JsResponse as Response } from '../types';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LoggerOptions {
  level?: LogLevel;
  format?: (entry: LogEntry) => string;
  destination?: NodeJS.WritableStream;
}

export class ConsoleLogger implements Logger {
  private level: LogLevel;
  private format: (entry: LogEntry) => string;
  private destination: NodeJS.WritableStream;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || LogLevel.INFO;
    this.format = options.format || this.defaultFormat;
    this.destination = options.destination || process.stdout;
  }

  private defaultFormat(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    return `${timestamp} ${level} ${entry.message}${
      entry.error ? `\n${entry.error.stack}` : ''
    }`;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private log(level: LogLevel, message: string, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      error,
    };

    this.destination.write(this.format(entry) + '\n');
  }

  debug(message: string): void {
    this.log(LogLevel.DEBUG, message);
  }

  info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  warn(message: string): void {
    this.log(LogLevel.WARN, message);
  }

  error(message: string, error?: Error): void {
    this.log(LogLevel.ERROR, message, error);
  }
}

export function createRequestLogger(logger: Logger) {
  return async (req: Request, next: () => Promise<Response>): Promise<Response> => {
    const startTime = Date.now();

    logger.info(`Request started: ${req.method} ${req.uri}`);

    try {
      const response = await next();
      const duration = Date.now() - startTime;

      logger.info(
        `Request completed: ${req.method} ${req.uri} ${response.status} ${duration}ms`
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        `Request failed: ${req.method} ${req.uri} ${duration}ms`,
        error instanceof Error ? error : new Error(String(error))
      );

      throw error;
    }
  };
}

export function createErrorLogger(logger: Logger) {
  return (error: Error): void => {
    logger.error('Unhandled error', error);
  };
}

// Utility functions for creating specialized loggers
export function createAccessLogger(options?: LoggerOptions): Logger {
  return new ConsoleLogger({
    ...options,
    format: (entry) => {
      const timestamp = new Date().toISOString();
      const { method, uri, status, duration } = entry as LogEntry & { method: string; uri: string; status: number; duration: number };
      return `${timestamp} ${method} ${uri} ${status} ${duration}ms`;
    },
  });
}

export function createErrorLoggerWithFormat(options?: LoggerOptions): Logger {
  return new ConsoleLogger({
    ...options,
    level: LogLevel.ERROR,
    format: (entry) => {
      const timestamp = new Date().toISOString();
      const { error } = entry;
      return `${timestamp} [ERROR] ${error?.name || 'Error'}: ${error?.message}\n${error?.stack || ''}`;
    },
  });
}

export { Logger }; 