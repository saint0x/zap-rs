import { Request, Response, Middleware, RouterError } from '../types';

export type ValidationSchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface ValidationSchema {
  type: ValidationSchemaType;
  required?: string[];
  properties?: Record<string, ValidationSchema>;
  items?: ValidationSchema;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
}

export interface ValidationOptions {
  abortEarly?: boolean;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
}

export interface ValidationErrorDetails {
  path: string[];
  message: string;
  type: string;
}

export class ValidationError extends Error {
  code: string = 'VALIDATION_ERROR';
  statusCode: number = 400;
  details: Record<string, unknown>;

  constructor(message: string, details: ValidationErrorDetails[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = { errors: details };
  }

  toResponse() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

Object.setPrototypeOf(ValidationError.prototype, RouterError.prototype);

export class Validator {
  constructor(private schema: ValidationSchema, private options: ValidationOptions = {}) {
    this.options = {
      abortEarly: true,
      allowUnknown: false,
      stripUnknown: false,
      ...options,
    };
  }

  async validate(data: unknown): Promise<unknown> {
    const errors: ValidationErrorDetails[] = [];
    const result = await this.validateNode(data, this.schema, [], errors);

    if (errors.length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    return result;
  }

  private async validateNode(
    data: unknown,
    schema: ValidationSchema,
    path: string[],
    errors: ValidationErrorDetails[]
  ): Promise<unknown> {
    if (!this.validateType(data, schema.type)) {
      errors.push({
        path,
        message: `Expected ${schema.type}, got ${typeof data}`,
        type: 'type',
      });
      if (this.options.abortEarly) {
        return data;
      }
    }

    if (schema.type === 'object' && typeof data === 'object' && data !== null) {
      const result: Record<string, unknown> = {};

      // Check required properties
      if (schema.required) {
        for (const prop of schema.required) {
          if (!(prop in data)) {
            errors.push({
              path: [...path, prop],
              message: `Property ${prop} is required`,
              type: 'required',
            });
            if (this.options.abortEarly) {
              return data;
            }
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in data) {
            result[key] = await this.validateNode(
              (data as Record<string, unknown>)[key],
              propSchema,
              [...path, key],
              errors
            );
          }
        }
      }

      return result;
    }

    if (schema.type === 'array' && Array.isArray(data)) {
      const result: unknown[] = [];

      if (schema.items) {
        for (let i = 0; i < data.length; i++) {
          result[i] = await this.validateNode(
            data[i],
            schema.items,
            [...path, i.toString()],
            errors
          );
        }
      }

      return result;
    }

    // Validate string constraints
    if (schema.type === 'string' && typeof data === 'string') {
      if (schema.minLength !== undefined && data.length < schema.minLength) {
        errors.push({
          path,
          message: `String must be at least ${schema.minLength} characters long`,
          type: 'string.minLength',
        });
        if (this.options.abortEarly) {
          return data;
        }
      }

      if (schema.maxLength !== undefined && data.length > schema.maxLength) {
        errors.push({
          path,
          message: `String must be at most ${schema.maxLength} characters long`,
          type: 'string.maxLength',
        });
        if (this.options.abortEarly) {
          return data;
        }
      }

      if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(data)) {
        errors.push({
          path,
          message: `String must match pattern ${schema.pattern}`,
          type: 'string.pattern',
        });
        if (this.options.abortEarly) {
          return data;
        }
      }
    }

    // Validate number constraints
    if (schema.type === 'number' && typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        errors.push({
          path,
          message: `Number must be at least ${schema.minimum}`,
          type: 'number.minimum',
        });
        if (this.options.abortEarly) {
          return data;
        }
      }

      if (schema.maximum !== undefined && data > schema.maximum) {
        errors.push({
          path,
          message: `Number must be at most ${schema.maximum}`,
          type: 'number.maximum',
        });
        if (this.options.abortEarly) {
          return data;
        }
      }
    }

    return data;
  }

  private validateType(data: unknown, type: ValidationSchemaType): boolean {
    switch (type) {
      case 'string':
        return typeof data === 'string';
      case 'number':
        return typeof data === 'number';
      case 'boolean':
        return typeof data === 'boolean';
      case 'object':
        return typeof data === 'object' && data !== null;
      case 'array':
        return Array.isArray(data);
      default:
        return false;
    }
  }
}

export function createValidator(schema: ValidationSchema, options?: ValidationOptions): Validator {
  return new Validator(schema, options);
}

export function createValidationMiddleware(schema: ValidationSchema): Middleware {
  const validator = new Validator(schema);
  return async (req: Request, next: () => Promise<Response>) => {
    try {
      await validator.validate(req.body);
      return next();
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw error;
    }
  };
} 