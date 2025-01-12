import 'reflect-metadata';
import { createRouter } from '../../../src/bindings';
import { createLogger } from '../../../src/logging/logger';
import { JsRequest, JsResponse, RouteHandler } from '../../../src/types';
import { TestController } from './controllers/test.controller';

const logger = createLogger({ level: 'debug' });
const router = createRouter();

// Register controller routes
const controller = new TestController();
const metadata = Reflect.getMetadata('controller', TestController);
if (metadata?.path) {
  const basePath = metadata.path;
  const prototype = Object.getPrototypeOf(controller);
  const propertyNames = Object.getOwnPropertyNames(prototype);

  for (const prop of propertyNames) {
    const routeMetadata = Reflect.getMetadata('route', prototype, prop);
    if (routeMetadata) {
      const { method, path } = routeMetadata;
      const fullPath = basePath + path;
      const handler = (controller[prop as keyof TestController] as Function).bind(controller) as RouteHandler;
      
      switch (method.toLowerCase()) {
        case 'get':
          router.get(fullPath, handler);
          break;
        case 'post':
          router.post(fullPath, handler);
          break;
        case 'put':
          router.put(fullPath, handler);
          break;
        case 'delete':
          router.delete(fullPath, handler);
          break;
      }
    }
  }
}

// Example requests
async function runTests() {
  try {
    // Test GET /test/hello
    const helloRequest: JsRequest = {
      method: 'GET',
      uri: '/test/hello',
      headers: {},
      params: {},
      query: {},
    };
    const helloResponse = await router.handle(helloRequest);
    logger.info('Hello response: ' + JSON.stringify(helloResponse));

    // Test POST /test/echo
    const echoRequest: JsRequest = {
      method: 'POST',
      uri: '/test/echo',
      headers: {},
      params: {},
      query: {},
      body: { message: 'Echo test' },
    };
    const echoResponse = await router.handle(echoRequest);
    logger.info('Echo response: ' + JSON.stringify(echoResponse));

    // Test PUT /test/update
    const updateRequest: JsRequest = {
      method: 'PUT',
      uri: '/test/update',
      headers: {},
      params: {},
      query: {},
      body: { data: 'Update test' },
    };
    const updateResponse = await router.handle(updateRequest);
    logger.info('Update response: ' + JSON.stringify(updateResponse));

    // Test DELETE /test/remove
    const deleteRequest: JsRequest = {
      method: 'DELETE',
      uri: '/test/remove',
      headers: {},
      params: {},
      query: {},
    };
    const deleteResponse = await router.handle(deleteRequest);
    logger.info('Delete response: ' + JSON.stringify(deleteResponse));

  } catch (error) {
    logger.error('Test error:', error as Error);
  }
}

runTests(); 