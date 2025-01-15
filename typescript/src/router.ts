import type { JsRequest, JsResponse } from './types';
import 'reflect-metadata';
import { Router as NativeRouter } from './mock-napi';

const metadataKey = 'zap:metadata';

type RouteMetadata = {
  method: string;
  path: string;
  guards?: ((request: JsRequest) => Promise<boolean>)[];
  middleware?: ((request: JsRequest, next: () => Promise<void>) => Promise<void>)[];
  validation?: (data: any) => Promise<any>;
  transform?: (data: any) => Promise<any>;
};

type ControllerMetadata = {
  basePath: string;
  routes: Map<string, RouteMetadata>;
};

export class Router {
  private nativeRouter: any;
  private controllers: Map<number, any> = new Map();

  constructor() {
    this.nativeRouter = new (require('zap-napi').Router)();
  }

  async registerController(controller: any): Promise<void> {
    const metadata = Reflect.getMetadata(metadataKey, controller.constructor) as ControllerMetadata;
    if (!metadata) {
      throw new Error('No metadata found for controller');
    }

    for (const [propertyKey, routeMetadata] of metadata.routes.entries()) {
      const handler = controller[propertyKey].bind(controller);
      const config: any = {};

      if (routeMetadata.guards) {
        const guardIds = await Promise.all(
          routeMetadata.guards.map(guard => this.nativeRouter.registerMiddleware(guard))
        );
        config.guards = guardIds;
      }

      if (routeMetadata.middleware) {
        const middlewareIds = await Promise.all(
          routeMetadata.middleware.map(mw => this.nativeRouter.registerMiddleware(mw))
        );
        config.middleware = middlewareIds;
      }

      if (routeMetadata.validation) {
        config.validation = await this.nativeRouter.registerMiddleware(routeMetadata.validation);
      }

      if (routeMetadata.transform) {
        config.transform = await this.nativeRouter.registerMiddleware(routeMetadata.transform);
      }

      const id = await this.nativeRouter.register(routeMetadata.method, routeMetadata.path, config);
      this.controllers.set(id, handler);
    }
  }

  async handle(request: JsRequest): Promise<JsResponse> {
    const result = await this.nativeRouter.getHandlerInfo(request.method, request.uri);
    if (!result) {
      throw new Error(`No handler found for ${request.method} ${request.uri}`);
    }

    const { id, params } = result;
    request.params = params;

    const handler = this.controllers.get(id);
    if (!handler) {
      throw new Error(`No handler found for id ${id}`);
    }

    const guards = await this.nativeRouter.getGuards(id);
    for (const guard of guards) {
      const allowed = await guard(request);
      if (!allowed) {
        throw new Error('Access denied by guard');
      }
    }

    const middlewareChain = await this.nativeRouter.getMiddlewareChain(id);
    for (const middleware of middlewareChain) {
      await middleware(request, async () => {});
    }

    const validation = await this.nativeRouter.getValidation(id);
    if (validation) {
      request.body = await validation(request.body);
    }

    let response = await handler(request);

    const transform = await this.nativeRouter.getTransform(id);
    if (transform) {
      response.body = await transform(response.body);
    }

    return response;
  }
} 