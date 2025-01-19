import { LogLevel, Logger } from '../types';

export function createLogger(level: LogLevel = 'info'): Logger {
    return {
        debug: (message: string) => {
            if (level === 'debug') console.debug(message);
        },
        info: (message: string) => {
            if (level === 'debug' || level === 'info') console.info(message);
        },
        warn: (message: string) => {
            if (level !== 'error') console.warn(message);
        },
        error: (message: string) => {
            console.error(message);
        }
    };
} 