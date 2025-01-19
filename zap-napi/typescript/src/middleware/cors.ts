import { Middleware } from '../types';

export interface CorsOptions {
  origin?: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

const defaultOptions: CorsOptions = {
  origin: '*',
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: [],
  credentials: false,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

function isOriginAllowed(origin: string, allowedOrigin: string | string[] | boolean): boolean {
  if (allowedOrigin === '*' || allowedOrigin === true) {
    return true;
  }
  if (Array.isArray(allowedOrigin)) {
    return allowedOrigin.includes(origin);
  }
  return origin === allowedOrigin;
}

export function cors(options: CorsOptions = {}): Middleware {
  const corsOptions = { ...defaultOptions, ...options };

  return async (request, next) => {
    const origin = request.headers['origin'];
    const method = request.method;

    // Handle preflight requests
    if (method === 'OPTIONS') {
      const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': corsOptions.methods!.join(', '),
        'Access-Control-Allow-Headers': corsOptions.allowedHeaders!.join(', '),
        'Access-Control-Max-Age': corsOptions.maxAge!.toString()
      };

      // Set allowed origin
      if (origin && corsOptions.origin) {
        if (isOriginAllowed(origin, corsOptions.origin)) {
          headers['Access-Control-Allow-Origin'] = origin;
        }
      } else if (corsOptions.origin === '*') {
        headers['Access-Control-Allow-Origin'] = '*';
      }

      // Set credentials header if enabled
      if (corsOptions.credentials) {
        headers['Access-Control-Allow-Credentials'] = 'true';
      }

      // Set exposed headers if configured
      if (corsOptions.exposedHeaders && corsOptions.exposedHeaders.length > 0) {
        headers['Access-Control-Expose-Headers'] = corsOptions.exposedHeaders.join(', ');
      }

      // Handle preflight continue option
      if (!corsOptions.preflightContinue) {
        Object.assign(request.headers, headers);
        return {
          status: corsOptions.optionsSuccessStatus!,
          headers,
          body: null
        };
      }
    }

    // Handle actual request
    if (origin && corsOptions.origin) {
      if (isOriginAllowed(origin, corsOptions.origin)) {
        request.headers['Access-Control-Allow-Origin'] = origin;
        if (corsOptions.credentials) {
          request.headers['Access-Control-Allow-Credentials'] = 'true';
        }
        if (corsOptions.exposedHeaders && corsOptions.exposedHeaders.length > 0) {
          request.headers['Access-Control-Expose-Headers'] = corsOptions.exposedHeaders.join(', ');
        }
      }
    } else if (corsOptions.origin === '*') {
      request.headers['Access-Control-Allow-Origin'] = '*';
    }

    await next();
  };
} 