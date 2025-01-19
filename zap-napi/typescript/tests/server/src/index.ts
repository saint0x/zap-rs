import 'reflect-metadata';
import { zap } from '../../../src/public';
import { TestController } from './controllers/test.controller';
import { cors } from '../../../src/middleware/cors';

async function main() {
    console.log('Creating router');
    const router = new zap.Router();
    
    // Add CORS middleware with custom options
    await router.use(cors({
        origin: ['http://localhost:3000', 'https://example.com'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],
        exposedHeaders: ['X-Custom-Response-Header'],
        credentials: true,
        maxAge: 3600
    }));

    console.log('Creating controller');
    new TestController(router);
    console.log('Controller created');

    // Test GET /api/hello
    const getResponse = await router.handle({
        method: 'GET',
        uri: '/api/hello',
        headers: {},
        body: null,
        params: {}
    });
    console.log('GET /api/hello:', getResponse);

    // Test POST /api/hello
    const postResponse = await router.handle({
        method: 'POST',
        uri: '/api/hello',
        headers: {},
        body: { name: 'Test User' },
        params: {}
    });
    console.log('POST /api/hello:', postResponse);

    // Test another POST /api/hello with empty body
    await router.handle({
        method: 'POST',
        uri: '/api/hello',
        headers: {},
        body: {},
        params: {}
    });

    // Test PUT /api/hello/123
    const putResponse = await router.handle({
        method: 'PUT',
        uri: '/api/hello/123',
        headers: { 'x-auth': 'secret' },
        body: { update: true },
        params: {}
    });
    console.log('PUT /api/hello/123:', putResponse);

    // Test another PUT /api/hello/123 without auth header
    await router.handle({
        method: 'PUT',
        uri: '/api/hello/123',
        headers: {},
        body: { update: true },
        params: {}
    });

    // Test DELETE /api/hello
    const deleteResponse = await router.handle({
        method: 'DELETE',
        uri: '/api/hello',
        headers: {},
        body: null,
        params: {}
    });
    console.log('DELETE /api/hello:', deleteResponse);

    // Test GET /api/query with query parameters
    const queryResponse = await router.handle({
        method: 'GET',
        uri: '/api/query?page=1&limit=10',
        headers: {},
        body: null,
        params: {}
    });
    console.log('GET /api/query:', queryResponse);

    // Test GET /api/headers with custom header
    const headerResponse = await router.handle({
        method: 'GET',
        uri: '/api/headers',
        headers: { 'x-custom': 'test-header' },
        body: null,
        params: {}
    });
    console.log('GET /api/headers:', headerResponse);

    // Test OPTIONS /api/hello
    const optionsResponse = await router.handle({
        method: 'OPTIONS',
        uri: '/api/hello',
        headers: {},
        body: null,
        params: {}
    });
    console.log('OPTIONS /api/hello:', optionsResponse);

    // Test HEAD /api/hello
    const headResponse = await router.handle({
        method: 'HEAD',
        uri: '/api/hello',
        headers: {},
        body: null,
        params: {}
    });
    console.log('HEAD /api/hello:', headResponse);

    // Test middleware
    const middlewareResponse = await router.handle({
        method: 'GET',
        uri: '/api/hello',
        headers: {},
        body: null,
        params: {}
    });
    console.log('GET /api/hello (with middleware):', middlewareResponse);

    // Allow time for decorators to register routes
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test CORS preflight request
    console.log('\nTesting CORS:');
    const preflightResponse = await router.handle({
        method: 'OPTIONS',
        uri: '/api/hello',
        headers: {
            'origin': 'http://localhost:3000',
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'content-type'
        },
        body: null,
        params: {}
    });
    console.log('OPTIONS /api/hello (CORS preflight):', preflightResponse);

    // Test CORS actual request
    const corsResponse = await router.handle({
        method: 'GET',
        uri: '/api/hello',
        headers: {
            'origin': 'http://localhost:3000'
        },
        body: null,
        params: {}
    });
    console.log('GET /api/hello (CORS):', corsResponse);

    // Test CORS with disallowed origin
    const corsDisallowedResponse = await router.handle({
        method: 'GET',
        uri: '/api/hello',
        headers: {
            'origin': 'http://evil.com'
        },
        body: null,
        params: {}
    });
    console.log('GET /api/hello (CORS disallowed):', corsDisallowedResponse);

    // Test error handling
    console.log('\nTesting error handling:');
    
    // Test route-specific error handler
    const errorResponse = await router.handle({
        method: 'GET',
        uri: '/api/error',
        headers: {},
        body: null,
        params: {}
    });
    console.log('GET /api/error:', errorResponse);

    // Test validation error
    const validationErrorResponse = await router.handle({
        method: 'POST',
        uri: '/api/error',
        headers: { 'Content-Type': 'application/json' },
        body: { notData: 'invalid' },
        params: {}
    });
    console.log('POST /api/error (validation error):', validationErrorResponse);

    // Test successful validation
    const validationSuccessResponse = await router.handle({
        method: 'POST',
        uri: '/api/error',
        headers: { 'Content-Type': 'application/json' },
        body: { data: 'valid string' },
        params: {}
    });
    console.log('POST /api/error (validation success):', validationSuccessResponse);

    // Test global error handler
    const internalErrorResponse = await router.handle({
        method: 'GET',
        uri: '/api/error/internal',
        headers: {},
        body: null,
        params: {}
    });
    console.log('GET /api/error/internal:', internalErrorResponse);

    // Test 404 error
    const notFoundResponse = await router.handle({
        method: 'GET',
        uri: '/api/not-found',
        headers: {},
        body: null,
        params: {}
    });
    console.log('GET /api/not-found:', notFoundResponse);
}

main().catch(error => {
    console.error('Server error:', error.message);
}); 