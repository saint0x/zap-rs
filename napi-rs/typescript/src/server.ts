import { createServer, Server as HttpServer } from 'http';
import { Router, Request, Response } from './types';

export class Server {
  private httpServer: HttpServer;

  constructor(private router: Router) {
    this.httpServer = createServer(this.handleRequest.bind(this));
  }

  private async handleRequest(req: any, res: any) {
    try {
      const request: Request = {
        method: req.method,
        url: req.url,
        path: req.url.split('?')[0],
        headers: req.headers,
        query: {},
        params: {},
        context: {
          id: Math.random().toString(36).substring(7),
          timestamp: Date.now(),
          metadata: {},
          state: new Map()
        }
      };

      // Parse body if present
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const bodyStr = Buffer.concat(chunks).toString();
        if (bodyStr) {
          try {
            request.body = JSON.parse(bodyStr);
          } catch {
            request.body = bodyStr;
          }
        }
      }

      // Handle the request through the router
      const response: Response = await this.router.handle(request);

      // Send response
      res.writeHead(response.status, response.headers);
      res.end(typeof response.body === 'string' ? response.body : JSON.stringify(response.body));

    } catch (error) {
      // Handle errors
      const status = error instanceof Error ? 500 : 400;
      const body = {
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'INTERNAL_ERROR'
        }
      };

      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    }
  }

  public listen(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(port, () => {
        resolve();
      });
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
} 