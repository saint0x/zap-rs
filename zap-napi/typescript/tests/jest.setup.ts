import 'reflect-metadata';
import { JsRequest, JsResponse } from '../src/types';

interface RouterMock {
    routes: Map<string, (req: JsRequest) => Promise<JsResponse>>;
    handleRequest: jest.Mock<Promise<JsResponse>, [JsRequest]>;
    addRoute: jest.Mock<void, [string, string, (req: JsRequest) => Promise<JsResponse>]>;
    addMiddleware: jest.Mock<void, [Function]>;
}

interface Mocks {
    router: RouterMock;
}

// Mock implementations
export const mocks: Mocks = {
    router: {
        routes: new Map(),
        handleRequest: jest.fn().mockImplementation(async (req: JsRequest) => {
            const key = `${req.method} ${req.uri}`;
            console.log(`Handling request for route: ${key}`);
            console.log('Available routes:', Array.from(mocks.router.routes.keys()));
            const handler = mocks.router.routes.get(key);
            if (!handler) {
                console.error(`No route found for ${req.method} ${req.uri}`);
                throw {
                    code: 404,
                    message: `No route found for ${req.method} ${req.uri}`
                };
            }
            try {
                return await handler(req);
            } catch (error) {
                console.error('Error handling request:', error);
                if (error && typeof error === 'object' && 'code' in error) {
                    throw error;
                }
                throw {
                    code: 500,
                    message: error instanceof Error ? error.message : 'Internal server error'
                };
            }
        }),
        addRoute: jest.fn((method: string, path: string, handler: (req: JsRequest) => Promise<JsResponse>) => {
            const key = `${method} ${path}`;
            console.log(`Registering route: ${key}`);
            mocks.router.routes.set(key, handler);
        }),
        addMiddleware: jest.fn(),
    }
};

// Reset all mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
    mocks.router.routes.clear();
    console.error = jest.fn();
    mocks.router.handleRequest.mockImplementation(async (req: JsRequest) => {
        const key = `${req.method} ${req.uri}`;
        console.log(`Handling request for route: ${key}`);
        console.log('Available routes:', Array.from(mocks.router.routes.keys()));
        const handler = mocks.router.routes.get(key);
        if (!handler) {
            console.error(`No route found for ${req.method} ${req.uri}`);
            throw {
                code: 404,
                message: `No route found for ${req.method} ${req.uri}`
            };
        }
        try {
            return await handler(req);
        } catch (error) {
            console.error('Error handling request:', error);
            if (error && typeof error === 'object' && 'code' in error) {
                throw error;
            }
            throw {
                code: 500,
                message: error instanceof Error ? error.message : 'Internal server error'
            };
        }
    });
});

// Mock the native module
const mockModule = {
    Router: jest.fn().mockImplementation(() => ({
        getHandlerId: jest.fn().mockImplementation((method, path) => {
            const key = `${method} ${path}`;
            return mocks.router.routes.has(key) ? key : null;
        }),
        register: jest.fn().mockImplementation((method, path) => {
            const key = `${method} ${path}`;
            mocks.router.routes.set(key, jest.fn());
            return key;
        })
    })),
    Hooks: jest.fn().mockImplementation(() => ({
        register_pre_routing: jest.fn().mockResolvedValue(1),
        register_post_handler: jest.fn().mockResolvedValue(2),
        register_error_handler: jest.fn().mockResolvedValue(3)
    }))
};

jest.mock('../src/native', () => ({
    __esModule: true,
    default: mockModule,
    Router: mockModule.Router,
    Hooks: mockModule.Hooks
})); 