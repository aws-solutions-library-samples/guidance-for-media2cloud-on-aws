module.exports = {
    setupTestFrameworkScriptFile: 'tests/setup.js',
    transform: {
      '^.+\\.jsx?$': 'babel-jest',
    },
    roots: ['<rootDir>'],
    testMatch: ['**/*.spec.js'],
    coveragePathIgnorePatterns: ['<rootDir>/lib/utils.test.js'],
    coverageReporters: [['lcov', { projectRoot: '../../../../' }], 'text'],
    setupFiles: ['<rootDir>/setEnvVars.js']
  };