require('reflect-metadata');
const http = require('http');
const { Router, Hooks } = require('./zap-napi');

// Create router instance
const hooks = new Hooks();
const router = new Router(hooks);

// Register routes
(async () => {
  try {
    console.log('Registering routes...');
    
    // Register routes
    const helloId = await router.register('GET', '/api/hello');
    console.log('Registered /api/hello with ID:', helloId);
    
    const echoId = await router.register('POST', '/api/echo');
    console.log('Registered /api/echo with ID:', echoId);
    
    const protectedId = await router.register('GET', '/api/protected');
    console.log('Registered /api/protected with ID:', protectedId);

    // Create server
    const server = http.createServer(async (req, res) => {
      try {
        console.log(`${req.method} ${req.url}`);

        // Parse request body if POST
        let body = null;
        if (req.method === 'POST') {
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          body = JSON.parse(Buffer.concat(chunks).toString());
          console.log('Request body:', body);
        }

        // Parse URL to get query parameters
        const url = new URL(req.url, `http://${req.headers.host}`);
        const query = Object.fromEntries(url.searchParams.entries());
        console.log('Query params:', query);

        // Get handler ID
        console.log('Looking up handler for:', req.method, url.pathname);
        const handlerId = await router.getHandlerId(req.method, url.pathname);
        console.log('Found handler ID:', handlerId);

        if (!handlerId) {
          console.log('No handler found');
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Not found' }));
          return;
        }

        // Handle request based on route ID
        let response;
        const request = {
          method: req.method,
          uri: url.pathname,
          headers: req.headers,
          body,
          params: {},
          query
        };

        console.log('Processing request for handler ID:', handlerId);
        switch (handlerId) {
          case helloId:
            response = {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
              body: { message: 'Hello World!' }
            };
            break;

          case echoId:
            response = {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
              body: request.body
            };
            break;

          case protectedId:
            if (request.headers['x-auth'] !== 'secret') {
              response = {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
                body: { error: 'Access denied' }
              };
            } else {
              response = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { message: 'Protected content' }
              };
            }
            break;

          default:
            response = {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
              body: { error: 'Not found' }
            };
        }

        console.log('Sending response:', response);
        res.writeHead(response.status, response.headers);
        res.end(JSON.stringify(response.body));
      } catch (err) {
        console.error('Error handling request:', err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    // Start server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Error during startup:', err);
    process.exit(1);
  }
})(); 