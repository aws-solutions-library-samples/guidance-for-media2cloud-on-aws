module.exports = {
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  roots: ['<rootDir>'],
  testMatch: ['**/*.spec.js'],
  coverageReporters: [['lcov', { projectRoot: '../../../' }], 'text'],
  setupFiles: ['<rootDir>/setEnvVars.js'],
};
