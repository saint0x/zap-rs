import { Logger, LoggerOptions, LogLevel, JsRequest } from '../types';

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level || 'info';
  const levels = ['debug', 'info', 'warn', 'error'];
  const levelIndex = levels.indexOf(level);

  function shouldLog(msgLevel: string): boolean {
    return levels.indexOf(msgLevel) >= levelIndex;
  }

  function formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  return {
    debug(message: string) {
      if (shouldLog('debug')) {
        console.debug(formatMessage('debug', message));
      }
    },
    info(message: string) {
      if (shouldLog('info')) {
        console.info(formatMessage('info', message));
      }
    },
    warn(message: string) {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', message));
      }
    },
    error(message: string, error?: Error) {
      if (shouldLog('error')) {
        console.error(formatMessage('error', message));
        if (error) {
          console.error(error);
        }
      }
    }
  };
}

export function createRequestLogger(logger: Logger) {
  return {
    logRequest(req: JsRequest) {
      logger.info(`${req.method} ${req.uri}`);
    },

    logResponse(req: JsRequest, status: number, duration: number) {
      logger.info(`${req.method} ${req.uri} - ${status} (${duration}ms)`);
    },

    logError(req: JsRequest, error: Error) {
      logger.error(`${req.method} ${req.uri} - Error: ${error.message}`, error);
    }
  };
} 