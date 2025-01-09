import { Middleware, CorsOptions } from '../types';

export function createCorsMiddleware(options: CorsOptions = {}): Middleware {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = false,
    maxAge,
    exposedHeaders = [],
    optionsSuccessStatus = 204
  } = options;

  const originValue = Array.isArray(origin) ? origin.join(', ') : origin;
  const corsHeaders = {
    'Access-Control-Allow-Origin': originValue,
    'Access-Control-Allow-Methods': methods.join(', '),
    'Access-Control-Allow-Headers': headers.join(', '),
    ...(credentials && { 'Access-Control-Allow-Credentials': 'true' }),
    ...(maxAge && { 'Access-Control-Max-Age': maxAge.toString() }),
    ...(exposedHeaders.length > 0 && {
      'Access-Control-Expose-Headers': exposedHeaders.join(', ')
    })
  };

  return async (req, next) => {
    if (req.method === 'OPTIONS') {
      return {
        status: optionsSuccessStatus,
        headers: corsHeaders,
        body: undefined
      };
    }

    const response = await next();
    response.headers = {
      ...response.headers,
      ...corsHeaders
    };
    return response;
  };
} 