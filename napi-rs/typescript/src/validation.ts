export type ValidationRule = {
  type: 'required' | 'string' | 'number' | 'boolean' | 'array' | 'object';
  message?: string;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  items?: ValidationRule;
  properties?: Record<string, ValidationRule>;
};

export type ValidationSchema = ValidationRule;

export type ValidationError = {
  path: string[];
  message: string;
};

export function validate(value: any, schema: ValidationSchema): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!schema) {
    return errors;
  }

  // Required check
  if (schema.required && (value === undefined || value === null)) {
    errors.push({
      path: [],
      message: schema.message || 'Value is required',
    });
    return errors;
  }

  // Skip validation if value is undefined/null and not required
  if (value === undefined || value === null) {
    return errors;
  }

  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push({
          path: [],
          message: schema.message || 'Value must be a string',
        });
      } else {
        if (schema.min !== undefined && value.length < schema.min) {
          errors.push({
            path: [],
            message: schema.message || `String must be at least ${schema.min} characters long`,
          });
        }
        if (schema.max !== undefined && value.length > schema.max) {
          errors.push({
            path: [],
            message: schema.message || `String must be at most ${schema.max} characters long`,
          });
        }
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
          errors.push({
            path: [],
            message: schema.message || 'String does not match pattern',
          });
        }
      }
      break;

    case 'number':
      if (typeof value !== 'number') {
        errors.push({
          path: [],
          message: schema.message || 'Value must be a number',
        });
      } else {
        if (schema.min !== undefined && value < schema.min) {
          errors.push({
            path: [],
            message: schema.message || `Number must be at least ${schema.min}`,
          });
        }
        if (schema.max !== undefined && value > schema.max) {
          errors.push({
            path: [],
            message: schema.message || `Number must be at most ${schema.max}`,
          });
        }
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push({
          path: [],
          message: schema.message || 'Value must be a boolean',
        });
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        errors.push({
          path: [],
          message: schema.message || 'Value must be an array',
        });
      } else {
        if (schema.min !== undefined && value.length < schema.min) {
          errors.push({
            path: [],
            message: schema.message || `Array must have at least ${schema.min} items`,
          });
        }
        if (schema.max !== undefined && value.length > schema.max) {
          errors.push({
            path: [],
            message: schema.message || `Array must have at most ${schema.max} items`,
          });
        }
        if (schema.items) {
          value.forEach((item, index) => {
            const itemErrors = validate(item, schema.items!);
            errors.push(...itemErrors.map(error => ({
              path: [index.toString(), ...error.path],
              message: error.message,
            })));
          });
        }
      }
      break;

    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push({
          path: [],
          message: schema.message || 'Value must be an object',
        });
      } else if (schema.properties) {
        Object.entries(schema.properties).forEach(([key, propertySchema]) => {
          const propertyErrors = validate(value[key], propertySchema);
          errors.push(...propertyErrors.map(error => ({
            path: [key, ...error.path],
            message: error.message,
          })));
        });
      }
      break;
  }

  return errors;
}

export function createValidationMiddleware(schema: ValidationSchema) {
  return async (req: any, next: () => Promise<any>) => {
    const errors = validate(req.body, schema);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }
    return next();
  };
} 