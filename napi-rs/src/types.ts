export interface Request {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
}

export interface Response {
    status: number;
    headers: Record<string, string>;
    body?: string;
}

export interface ErrorResponse {
    error: {
        code: string;
        message: string;
        details?: any;
    };
}

export interface RouteParams {
    pathParams: Record<string, string>;
    queryParams: Record<string, string>;
}

export interface ControllerMetadata {
    path: string;
}

export interface RouteMetadata {
    method: string;
    path: string;
}

export interface RouterOptions {
    port?: number;
    host?: string;
    middleware?: any[];
    hooks?: any[];
} 