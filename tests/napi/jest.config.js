module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      compiler: 'typescript',
      isolatedModules: true,
      diagnostics: {
        ignoreCodes: [151001]
      }
    }]
  },
  moduleNameMapper: {
    '^@zap/(.*)$': '<rootDir>/../../napi-rs/typescript/src/$1'
  }
}; 