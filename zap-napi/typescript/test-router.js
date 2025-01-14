const { createRouter } = require('./dist/src/bindings');

async function runTest() {
    console.log('Creating router...');
    const router = createRouter();
    console.log('Router created successfully');

    // Test registering a route
    console.log('Registering test route...');
    await router.get('/test', (req) => {
        console.log('Handling request:', req);
        return { status: 200, body: 'Test successful' };
    });
    console.log('Test route registered');

    // Test handling a request
    console.log('Creating test request...');
    const testRequest = {
        method: 'GET',
        uri: '/test',
        headers: {},
        params: {},
        query: {},
        body: null
    };

    console.log('Handling test request...');
    try {
        const response = await router.handle(testRequest);
        console.log('Request handled successfully:', response);
    } catch (error) {
        console.error('Error handling request:', error);
    }
}

runTest().catch(console.error); 