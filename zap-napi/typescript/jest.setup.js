const path = require('path');

// Enable experimental decorators
require('reflect-metadata');

// Mock console methods for testing
global.console = {
    ...console,
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Mock the native module
jest.mock('zap-napi', () => {
    const nativeModule = require(path.join(__dirname, 'dist', 'index.node'));
    return nativeModule;
});

// Register ts-node to handle TypeScript files
require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
        module: 'commonjs',
    },
}); 