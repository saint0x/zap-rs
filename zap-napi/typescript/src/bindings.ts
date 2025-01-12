import { JsRequest, JsResponse, RouteHandler, Router } from './types';
import * as path from 'path';
import { Logger } from './types';

// Load native module
let nativeModule: any;
try {
  const modulePath = path.resolve(__dirname, '../index.node');
  nativeModule = require(modulePath);
} catch (e) {
  throw new Error('Failed to load native module. Make sure the Rust code is built: ' + e);
}

// Store handlers to keep them alive
const handlers = new Map<string, RouteHandler>();

// Default logger for debugging
const defaultLogger: Logger = {
  debug: (msg: string) => console.debug(`[Debug] ${msg}`),
  info: (msg: string) => console.info(`[Info] ${msg}`),
  warn: (msg: string) => console.warn(`[Warn] ${msg}`),
  error: (msg: string, error?: Error) => console.error(`[Error] ${msg}`, error),
};

let logger = defaultLogger;

export function setLogger(customLogger: Logger) {
  logger = customLogger;
}

// Factory functions
export const createRouter = (): Router => {
  const nativeRouter = new nativeModule.Router();
  logger.debug('Created new native router');
  
  return {
    handle: async (request: JsRequest): Promise<JsResponse> => {
      logger.debug(`Handling ${request.method} ${request.uri}`);
      try {
        const response = await nativeRouter.handle(request);
        logger.debug(`Response: ${JSON.stringify(response)}`);
        return response;
      } catch (error) {
        logger.error('Error handling request', error as Error);
        throw error;
      }
    },
    get: (path: string, handler: RouteHandler) => {
      const key = `GET ${path}`;
      logger.debug(`Registering GET handler for ${path}`);
      handlers.set(key, handler);
      nativeRouter.get(path, handler);
    },
    post: (path: string, handler: RouteHandler) => {
      const key = `POST ${path}`;
      logger.debug(`Registering POST handler for ${path}`);
      handlers.set(key, handler);
      nativeRouter.post(path, handler);
    },
    put: (path: string, handler: RouteHandler) => {
      const key = `PUT ${path}`;
      logger.debug(`Registering PUT handler for ${path}`);
      handlers.set(key, handler);
      nativeRouter.put(path, handler);
    },
    delete: (path: string, handler: RouteHandler) => {
      const key = `DELETE ${path}`;
      logger.debug(`Registering DELETE handler for ${path}`);
      handlers.set(key, handler);
      nativeRouter.delete(path, handler);
    },
  };
}; 