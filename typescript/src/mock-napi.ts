export class Router {
  private routes = new Map<number, { method: string; path: string; config?: any }>();
  private nextId = 1;
  private middlewares = new Map<number, Function>();

  constructor() {}

  async register(method: string, path: string, config?: any): Promise<number> {
    const id = this.nextId++;
    this.routes.set(id, { method, path, config });
    return id;
  }

  async registerMiddleware(middleware: Function): Promise<number> {
    const id = this.nextId++;
    this.middlewares.set(id, middleware);
    return id;
  }

  async getHandlerInfo(method: string, uri: string): Promise<{ id: number; params: Record<string, string> } | null> {
    for (const [id, route] of this.routes.entries()) {
      if (route.method === method && this.matchPath(route.path, uri)) {
        const params = this.extractParams(route.path, uri);
        return { id, params };
      }
    }
    return null;
  }

  async getGuards(id: number): Promise<Function[]> {
    const route = this.routes.get(id);
    return route?.config?.guards || [];
  }

  async getMiddlewareChain(id: number): Promise<Function[]> {
    const route = this.routes.get(id);
    return route?.config?.middleware || [];
  }

  async getValidation(id: number): Promise<Function | null> {
    const route = this.routes.get(id);
    return route?.config?.validation || null;
  }

  async getTransform(id: number): Promise<Function | null> {
    const route = this.routes.get(id);
    return route?.config?.transform || null;
  }

  private matchPath(pattern: string, uri: string): boolean {
    const patternParts = pattern.split('/');
    const uriParts = uri.split('/');
    
    if (patternParts.length !== uriParts.length) return false;
    
    return patternParts.every((part, i) => {
      if (part.startsWith(':')) return true;
      return part === uriParts[i];
    });
  }

  private extractParams(pattern: string, uri: string): Record<string, string> {
    const params: Record<string, string> = {};
    const patternParts = pattern.split('/');
    const uriParts = uri.split('/');
    
    patternParts.forEach((part, i) => {
      if (part.startsWith(':')) {
        const paramName = part.slice(1);
        params[paramName] = uriParts[i];
      }
    });
    
    return params;
  }
}

export class Hooks {
  constructor() {}
} 