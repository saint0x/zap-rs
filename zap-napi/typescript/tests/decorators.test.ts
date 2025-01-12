import 'reflect-metadata';
import { Controller, Get, Post, Put, Delete } from '../src/decorators';
import { JsRequest, JsResponse } from '../src/types';

describe('Decorators', () => {
  it('should set controller metadata', () => {
    @Controller('/test')
    class TestController {}

    const metadata = Reflect.getMetadata('controller', TestController);
    expect(metadata).toBeDefined();
    expect(metadata.path).toBe('/test');
  });

  it('should set route metadata', () => {
    class TestController {
      @Get('/test')
      testMethod() {}
    }

    const metadata = Reflect.getMetadata('route', TestController.prototype, 'testMethod');
    expect(metadata).toBeDefined();
    expect(metadata.method).toBe('get');
    expect(metadata.path).toBe('/test');
  });
}); 