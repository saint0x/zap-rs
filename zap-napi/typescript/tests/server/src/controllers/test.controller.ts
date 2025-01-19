import 'reflect-metadata';
import { zap } from '../../../../src/public';
import { JsRequest, JsResponse } from '../../../../src/types';

// Middleware for testing
const testMiddleware: zap.Middleware = async (req: zap.Request, next: () => Promise<void>) => {
    console.log('Applying test middleware');
    req.headers['x-middleware'] = 'applied';
    await next();
};

// Guard for testing
const authGuard: zap.Guard = async (req: zap.Request): Promise<boolean> => {
    console.log('Checking auth guard');
    return req.headers['x-auth'] === 'secret';
};

// Validation for testing
const validateUser = async (data: any): Promise<any> => {
    console.log('Validating user data:', data);
    if (!data.name) {
        throw new Error('Name is required');
    }
    return data;
};

// Transform for testing
const transformResponse = async (data: any): Promise<any> => {
    console.log('Transforming response data:', data);
    return { ...data, transformed: true };
};

@zap.controller('/api', [testMiddleware])
export class TestController {
    constructor(private router: zap.Router) {
        console.log('TestController constructor called');

        // Register error handlers
        this.router.onError(async (error: Error, request: JsRequest) => {
            console.log(`[ERROR] Global error handler: ${error.message}`);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    type: 'Json',
                    content: {
                        error: {
                            code: 'INTERNAL_ERROR',
                            message: error.message,
                            path: request.uri
                        }
                    }
                }
            };
        });

        // Route-specific error handler
        this.router.onRouteError('/api/error', async (error: Error, request: JsRequest) => {
            console.log(`[ERROR] Route error handler: ${error.message}`);
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    type: 'Json',
                    content: {
                        error: {
                            code: 'BAD_REQUEST',
                            message: error.message,
                            path: request.uri
                        }
                    }
                }
            };
        });
    }

    @zap.get('/hello')
    @zap.response(transformResponse)
    async getHello(): Promise<zap.Response> {
        console.log('getHello called');
        return zap.createResponse(200, {}, { message: 'Hello World!' });
    }

    @zap.post('/hello')
    @zap.validate(validateUser)
    @zap.status(201)
    async postHello(@zap.body() data: any): Promise<zap.Response> {
        console.log('postHello called with data:', data);
        return zap.createResponse(201, {}, { message: 'Created', data });
    }

    @zap.put('/hello/:id')
    @zap.guard(authGuard)
    async putHello(
        @zap.param('id') id: string,
        @zap.body() data: any
    ): Promise<zap.Response> {
        console.log('putHello called with id:', id, 'and data:', data);
        return zap.createResponse(200, {}, { message: 'Updated', id, data });
    }

    @zap.del('/hello')
    async deleteHello(): Promise<zap.Response> {
        console.log('deleteHello called');
        return zap.createResponse(204, {}, null);
    }

    @zap.get('/query')
    async getWithQuery(
        @zap.query('page') page: string,
        @zap.query('limit') limit: string
    ): Promise<zap.Response> {
        console.log('getWithQuery called with page:', page, 'and limit:', limit);
        return zap.createResponse(200, {}, { page, limit });
    }

    @zap.get('/headers')
    async getWithHeaders(
        @zap.header('x-custom') custom: string
    ): Promise<zap.Response> {
        console.log('getWithHeaders called with custom header:', custom);
        return zap.createResponse(200, {}, { custom });
    }

    @zap.options('/hello')
    async optionsHello(): Promise<zap.Response> {
        console.log('optionsHello called');
        return zap.createResponse(200, {
            'Allow': 'GET, POST, PUT, DELETE, OPTIONS'
        }, null);
    }

    @zap.head('/hello')
    async headHello(): Promise<zap.Response> {
        console.log('headHello called');
        return zap.createResponse(200, {
            'Content-Type': 'application/json',
            'Content-Length': '123'
        }, null);
    }

    @zap.get('/error')
    async getError(_request: JsRequest): Promise<JsResponse> {
        throw new Error('This is a test error');
    }

    @zap.post('/error')
    async postError(request: JsRequest): Promise<JsResponse> {
        if (!request.body || typeof request.body.data !== 'string') {
            throw new Error('Invalid request body: data field must be a string');
        }
        return {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
            body: {
                type: 'Json',
                content: { message: 'Created', data: request.body.data }
            }
        };
    }

    @zap.get('/error/internal')
    async getInternalError(_request: JsRequest): Promise<JsResponse> {
        // This error will be caught by the global error handler
        throw new Error('Internal server error');
    }
} 