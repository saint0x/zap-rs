import { Logger, LoggerOptions, LogLevel, Request } from '../types';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

function isLevelEnabled(messageLevel: LogLevel, configLevel: LogLevel): boolean {
  return LOG_LEVELS[messageLevel] >= LOG_LEVELS[configLevel];
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>, options: { timestamp: boolean; format: string } = { timestamp: true, format: 'json' }): void {
  const logEntry = {
    level,
    message,
    ...(options.timestamp && { timestamp: Date.now() }),
    ...(meta && { meta })
  };

  if (options.format === 'json') {
    console[level](JSON.stringify(logEntry));
  } else {
    console[level](message, meta || '');
  }
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const {
    level = 'info',
    format = 'json',
    timestamp = true,
  } = options;

  return {
    debug(message: string, meta?: Record<string, unknown>) {
      if (isLevelEnabled('debug', level as LogLevel)) {
        log('debug', message, meta, { timestamp, format });
      }
    },
    info(message: string, meta?: Record<string, unknown>) {
      if (isLevelEnabled('info', level as LogLevel)) {
        log('info', message, meta, { timestamp, format });
      }
    },
    warn(message: string, meta?: Record<string, unknown>) {
      if (isLevelEnabled('warn', level as LogLevel)) {
        log('warn', message, meta, { timestamp, format });
      }
    },
    error(message: string, meta?: Record<string, unknown>) {
      if (isLevelEnabled('error', level as LogLevel)) {
        log('error', message, meta, { timestamp, format });
      }
    }
  };
}

export function createRequestLogger(logger: Logger): (req: Request) => Promise<void> {
  return async (req: Request) => {
    const start = Date.now();
    logger.info(`${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      requestId: req.context?.id
    });

    try {
      await Promise.resolve(); // Wait for request to complete
      const duration = Date.now() - start;
      logger.info(`Completed ${req.method} ${req.url}`, {
        method: req.method,
        url: req.url,
        requestId: req.context?.id,
        duration
      });
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`Failed ${req.method} ${req.url}`, {
        method: req.method,
        url: req.url,
        requestId: req.context?.id,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
} 