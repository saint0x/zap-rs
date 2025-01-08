import { ValidationSchema, ValidationOptions, ValidationError } from '../types';
import { createValidator } from './index';

const VALIDATION_METADATA_KEY = Symbol('validation');

export interface ValidationMetadata {
  body?: ValidationSchema;
  query?: ValidationSchema;
  params?: ValidationSchema;
  options?: ValidationOptions;
}

/**
 * Validates request body against the provided schema
 */
export function validateBody(schema: ValidationSchema, options?: ValidationOptions): MethodDecorator {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const metadata: ValidationMetadata = Reflect.getMetadata(VALIDATION_METADATA_KEY, target, propertyKey) || {};
    metadata.body = schema;
    metadata.options = options;
    Reflect.defineMetadata(VALIDATION_METADATA_KEY, metadata, target, propertyKey);
    return descriptor;
  };
}

/**
 * Validates request query parameters against the provided schema
 */
export function validateQuery(schema: ValidationSchema, options?: ValidationOptions): MethodDecorator {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const metadata: ValidationMetadata = Reflect.getMetadata(VALIDATION_METADATA_KEY, target, propertyKey) || {};
    metadata.query = schema;
    metadata.options = options;
    Reflect.defineMetadata(VALIDATION_METADATA_KEY, metadata, target, propertyKey);
    return descriptor;
  };
}

/**
 * Validates request path parameters against the provided schema
 */
export function validateParams(schema: ValidationSchema, options?: ValidationOptions): MethodDecorator {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const metadata: ValidationMetadata = Reflect.getMetadata(VALIDATION_METADATA_KEY, target, propertyKey) || {};
    metadata.params = schema;
    metadata.options = options;
    Reflect.defineMetadata(VALIDATION_METADATA_KEY, metadata, target, propertyKey);
    return descriptor;
  };
}

/**
 * Creates a validation middleware from the metadata
 */
export function createValidationMiddleware(metadata: ValidationMetadata) {
  const bodyValidator = metadata.body ? createValidator(metadata.body, metadata.options) : null;
  const queryValidator = metadata.query ? createValidator(metadata.query, metadata.options) : null;
  const paramsValidator = metadata.params ? createValidator(metadata.params, metadata.options) : null;

  return async (req: Request, next: () => Promise<Response>): Promise<Response> => {
    try {
      // Validate body
      if (bodyValidator && req.body) {
        req.body = await bodyValidator.validate(req.body);
      }

      // Validate query
      if (queryValidator && req.query) {
        req.query = await queryValidator.validate(req.query) as Record<string, string>;
      }

      // Validate params
      if (paramsValidator && req.params) {
        req.params = await paramsValidator.validate(req.params) as Record<string, string>;
      }

      return next();
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'VALIDATION_ERROR') {
        const validationError = error as ValidationError;
        throw {
          code: 'VALIDATION_ERROR',
          statusCode: 400,
          message: 'Validation failed',
          details: validationError.details,
        };
      }
      throw error;
    }
  };
}

/**
 * Gets validation metadata from a method
 */
export function getValidationMetadata(target: any, propertyKey: string): ValidationMetadata | undefined {
  return Reflect.getMetadata(VALIDATION_METADATA_KEY, target, propertyKey);
} 