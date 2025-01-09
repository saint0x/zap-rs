import { 
  createRouter, 
  createBodyParserMiddleware, 
  createCorsMiddleware, 
  createLogger,
  createHooks,
  Server,
  Request,
  Response 
} from '@zap-rs/core';
import { TestController } from './controllers/test.controller';
import chalk from 'chalk';

const log = {
  info: (msg: string, meta?: any) => console.log(chalk.blue(`ℹ️  ${msg}`), meta ? chalk.gray(JSON.stringify(meta, null, 2)) : ''),
  success: (msg: string, meta?: any) => console.log(chalk.green(`✅ ${msg}`), meta ? chalk.gray(JSON.stringify(meta, null, 2)) : ''),
  warn: (msg: string, meta?: any) => console.log(chalk.yellow(`⚠️  ${msg}`), meta ? chalk.gray(JSON.stringify(meta, null, 2)) : ''),
  error: (msg: string, meta?: any) => console.log(chalk.red(`❌ ${msg}`), meta ? chalk.gray(JSON.stringify(meta, null, 2)) : ''),
  debug: (msg: string, meta?: any) => console.log(chalk.magenta(`🔍 ${msg}`), meta ? chalk.gray(JSON.stringify(meta, null, 2)) : ''),
  http: (msg: string, meta?: any) => console.log(chalk.cyan(`🌐 ${msg}`), meta ? chalk.gray(JSON.stringify(meta, null, 2)) : '')
};

async function main() {
  try {
    log.info('Starting Zap server setup...');

    // Create logger
    log.debug('Creating logger...');
    const logger = createLogger();
    log.success('Logger created');

    // Create router and hooks
    log.debug('Creating router and hooks...');
    const router = createRouter();
    const hooks = createHooks();
    log.success('Router and hooks created');

    // Add hooks
    log.debug('Setting up request hooks...');
    hooks.addPreRouting(async (req: Request) => {
      log.http(`➡️  Incoming ${req.method} request to ${req.url}`, {
        headers: req.headers,
        query: req.query,
        params: req.params
      });
      return req;
    });

    hooks.addPostHandler(async (res: Response) => {
      log.http(`⬅️  Outgoing response ${res.status}`, {
        headers: res.headers
      });
      return res;
    });

    // Set up error handling
    log.debug('Configuring error handler...');
    router.setErrorHandler(async (error) => {
      log.error('Request failed', { 
        code: error.code,
        message: error.message,
        details: error.details 
      });

      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: {
          error: {
            code: error.code || 'INTERNAL_ERROR',
            message: error.message,
            details: error.details
          }
        }
      };
    });
    log.success('Error handler configured');

    // Add global middleware
    log.debug('Setting up global middleware...');
    log.debug('Adding CORS middleware...');
    router.use(createCorsMiddleware({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    }));
    log.success('CORS middleware added');

    log.debug('Adding body parser middleware...');
    router.use(createBodyParserMiddleware());
    log.success('Body parser middleware added');

    // Register controllers
    log.debug('Registering controllers...');
    router.registerController(new TestController());
    log.success('Controllers registered');

    // Create and start server
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    log.info(`Starting server on port ${port}...`);
    
    const server = new Server(router);
    await server.listen(port);
    log.success(`🚀 Server is running at http://localhost:${port}`);
    log.info('Available test endpoints:', {
      hello: 'GET /api/hello',
      echo: 'GET /api/echo',
      createUser: 'POST /api/users',
      getUser: 'GET /api/users/:id',
      updateUser: 'PUT /api/users/:id',
      deleteUser: 'DELETE /api/users/:id',
      error: 'GET /api/error',
      clearStore: 'GET /api/store/clear'
    });

  } catch (error) {
    log.error('Failed to start server:', error);
    process.exit(1);
  }
}

main(); 