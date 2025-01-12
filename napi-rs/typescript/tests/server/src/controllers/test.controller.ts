import { Controller, Get, Post, Put, Delete } from '../../../../src/decorators';
import { JsRequest, JsResponse } from '../../../../src/types';

@Controller('/test')
export class TestController {
  @Get('/hello')
  async hello(): Promise<JsResponse> {
    return {
      status: 200,
      headers: {},
      body: {
        type: 'Json',
        content: { message: 'Hello World' }
      }
    };
  }

  @Post('/echo')
  async echo(request: JsRequest): Promise<JsResponse> {
    return {
      status: 200,
      headers: {},
      body: {
        type: 'Json',
        content: request.body
      }
    };
  }

  @Put('/update')
  async update(request: JsRequest): Promise<JsResponse> {
    return {
      status: 200,
      headers: {},
      body: {
        type: 'Json',
        content: { updated: true, ...request.body }
      }
    };
  }

  @Delete('/remove')
  async remove(): Promise<JsResponse> {
    return {
      status: 200,
      headers: {},
      body: {
        type: 'Json',
        content: { deleted: true }
      }
    };
  }
} 