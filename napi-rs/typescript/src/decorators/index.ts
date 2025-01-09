export function route(pathOrConfig: string | { path: string; method?: string }) {
  const getConfig = () => {
    if (typeof pathOrConfig === 'string') {
      return { path: pathOrConfig, method: 'GET' };
    }
    return { ...pathOrConfig, method: pathOrConfig.method || 'GET' };
  };

  return function (
    target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>
  ): TypedPropertyDescriptor<(...args: any[]) => Promise<any>> {
    const { path, method } = getConfig();
    const originalMethod = descriptor.value;
    if (!originalMethod) {
      throw new Error('Route decorator can only be applied to methods');
    }

    const metadata = {
      path,
      method: method.toUpperCase(),
      middlewares: [],
      hooks: [],
      validation: null,
      options: {}
    };
    
    Reflect.defineMetadata('zap:route', metadata, target, propertyKey);
    return descriptor;
  };
} 