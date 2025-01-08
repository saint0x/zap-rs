import 'reflect-metadata';

// Mock the native bindings
const mockRouter = {
  addRoute: jest.fn(),
  addMiddleware: jest.fn(),
  handleRequest: jest.fn()
};

const mockStore = {
  set: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn()
};

const mockHooks = {
  addHook: jest.fn(),
  removeHook: jest.fn()
};

(global as any).__zap_native = {
  createRouter: () => mockRouter,
  createStore: () => mockStore,
  createHooks: () => mockHooks
};

// Export mocks for test usage
export const mocks = {
  router: mockRouter,
  store: mockStore,
  hooks: mockHooks
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
}); 