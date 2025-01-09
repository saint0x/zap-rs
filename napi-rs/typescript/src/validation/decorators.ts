import { ValidationSchema, ValidationOptions, ValidationError, Request } from '../types';

export function validate(schema: ValidationSchema, options: ValidationOptions = {}): MethodDecorator {
  return (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const request = args[0] as Request;
      if (!request || !request.body) {
        throw new ValidationError('Request body is required');
      }

      try {
        // Validate request body
        const validatedBody = validateSchema(schema, request.body, options);
        Object.defineProperty(request, 'body', {
          value: validatedBody,
          writable: false,
          enumerable: true,
          configurable: true
        });

        return await originalMethod.apply(this, args);
      } catch (error) {
        if (error instanceof Error) {
          throw new ValidationError(error.message);
        }
        throw error;
      }
    };

    return descriptor;
  };
}

export function validateQuery(schema: ValidationSchema, options: ValidationOptions = {}): MethodDecorator {
  return (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const request = args[0] as Request;
      if (!request) {
        throw new ValidationError('Request is required');
      }

      try {
        // Validate query parameters
        const validatedQuery = validateSchema(schema, request.query || {}, options);
        Object.defineProperty(request, 'query', {
          value: validatedQuery,
          writable: false,
          enumerable: true,
          configurable: true
        });

        return await originalMethod.apply(this, args);
      } catch (error) {
        if (error instanceof Error) {
          throw new ValidationError(error.message);
        }
        throw error;
      }
    };

    return descriptor;
  };
}

export function validateParams(schema: ValidationSchema, options: ValidationOptions = {}): MethodDecorator {
  return (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const request = args[0] as Request;
      if (!request) {
        throw new ValidationError('Request is required');
      }

      try {
        // Validate path parameters
        const validatedParams = validateSchema(schema, request.params || {}, options);
        Object.defineProperty(request, 'params', {
          value: validatedParams,
          writable: false,
          enumerable: true,
          configurable: true
        });

        return await originalMethod.apply(this, args);
      } catch (error) {
        if (error instanceof Error) {
          throw new ValidationError(error.message);
        }
        throw error;
      }
    };

    return descriptor;
  };
}

function validateSchema(schema: ValidationSchema, data: unknown, options: ValidationOptions): unknown {
  if (!data) {
    throw new Error('Data is required');
  }

  // Basic type validation
  if (schema.type === 'object' && typeof data !== 'object') {
    throw new Error(`Expected object, got ${typeof data}`);
  }
  if (schema.type === 'array' && !Array.isArray(data)) {
    throw new Error(`Expected array, got ${typeof data}`);
  }
  if (schema.type === 'string' && typeof data !== 'string') {
    throw new Error(`Expected string, got ${typeof data}`);
  }
  if (schema.type === 'number' && typeof data !== 'number') {
    throw new Error(`Expected number, got ${typeof data}`);
  }
  if (schema.type === 'boolean' && typeof data !== 'boolean') {
    throw new Error(`Expected boolean, got ${typeof data}`);
  }

  // Object property validation
  if (schema.type === 'object' && schema.properties && typeof data === 'object') {
    const validatedData: Record<string, unknown> = {};
    const dataObj = data as Record<string, unknown>;
    const properties = schema.properties;  // Assign to local variable to satisfy type checker

    // Check required properties
    if (schema.required) {
      for (const required of schema.required) {
        if (!(required in dataObj)) {
          throw new Error(`Missing required property: ${required}`);
        }
      }
    }

    // Validate each property
    for (const [key, propSchema] of Object.entries(properties)) {
      if (key in dataObj) {
        validatedData[key] = validateSchema(propSchema, dataObj[key], options);
      }
    }

    // Handle unknown properties based on options
    if (!options.allowUnknown) {
      const unknownProps = Object.keys(dataObj).filter(key => !(key in properties));
      if (unknownProps.length > 0) {
        throw new Error(`Unknown properties: ${unknownProps.join(', ')}`);
      }
    }

    return options.stripUnknown ? validatedData : { ...dataObj, ...validatedData };
  }

  // String validation
  if (schema.type === 'string' && typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      throw new Error(`String must be at least ${schema.minLength} characters long`);
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      throw new Error(`String must be at most ${schema.maxLength} characters long`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      throw new Error(`String must match pattern: ${schema.pattern}`);
    }
  }

  // Number validation
  if (schema.type === 'number' && typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      throw new Error(`Number must be at least ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      throw new Error(`Number must be at most ${schema.maximum}`);
    }
  }

  return data;
} 