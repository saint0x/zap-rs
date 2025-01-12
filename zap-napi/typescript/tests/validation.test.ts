import { validate, ValidationSchema, ValidationError } from '../src/validation';

describe('Validation', () => {
  const schema: ValidationSchema = {
    type: 'object',
    properties: {
      username: {
        type: 'string',
        required: true,
        min: 3,
        max: 20
      },
      email: {
        type: 'string',
        required: true,
        pattern: '^[^@]+@[^@]+\\.[^@]+$'
      },
      age: {
        type: 'number',
        min: 0,
        max: 150
      },
      isActive: {
        type: 'boolean'
      },
      tags: {
        type: 'array',
        items: {
          type: 'string'
        },
        min: 1,
        max: 5
      }
    }
  };

  it('should validate required fields', () => {
    const data = {};
    const errors = validate(data, schema);
    
    expect(errors).toContainEqual({
      path: ['username'],
      message: 'Value is required'
    });
    expect(errors).toContainEqual({
      path: ['email'],
      message: 'Value is required'
    });
  });

  it('should validate string length', () => {
    const data = {
      username: 'a',
      email: 'test@example.com'
    };
    const errors = validate(data, schema);
    
    expect(errors).toContainEqual({
      path: ['username'],
      message: 'String must be at least 3 characters long'
    });
  });

  it('should validate email pattern', () => {
    const data = {
      username: 'testuser',
      email: 'invalid-email'
    };
    const errors = validate(data, schema);
    
    expect(errors).toContainEqual({
      path: ['email'],
      message: 'String does not match pattern'
    });
  });

  it('should validate number range', () => {
    const data = {
      username: 'testuser',
      email: 'test@example.com',
      age: -1
    };
    const errors = validate(data, schema);
    
    expect(errors).toContainEqual({
      path: ['age'],
      message: 'Number must be at least 0'
    });
  });

  it('should validate array length', () => {
    const data = {
      username: 'testuser',
      email: 'test@example.com',
      tags: []
    };
    const errors = validate(data, schema);
    
    expect(errors).toContainEqual({
      path: ['tags'],
      message: 'Array must have at least 1 items'
    });
  });

  it('should validate array items', () => {
    const data = {
      username: 'testuser',
      email: 'test@example.com',
      tags: [123]
    };
    const errors = validate(data, schema);
    
    expect(errors).toContainEqual({
      path: ['tags', '0'],
      message: 'Value must be a string'
    });
  });

  it('should pass validation for valid data', () => {
    const data = {
      username: 'testuser',
      email: 'test@example.com',
      age: 25,
      isActive: true,
      tags: ['tag1', 'tag2']
    };
    const errors = validate(data, schema);
    
    expect(errors).toHaveLength(0);
  });
}); 