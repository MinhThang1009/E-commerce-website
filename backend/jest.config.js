module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['./src/__tests__/setup.js'],
  clearMocks: true,
};
