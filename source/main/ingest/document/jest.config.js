module.exports = {
    transform: {
      '^.+\\.jsx?$': 'babel-jest',
    },
    roots: ['<rootDir>'],
    testMatch: ['**/*.spec.js'],
    coveragePathIgnorePatterns: ['<rootDir>/lib/utils.test.js'],
    coverageReporters: [['lcov', { projectRoot: '../../../../' }], 'text'],
    setupFiles: ['<rootDir>/setEnvVars.js'],
    modulePaths: [
      "<rootDir>/../../../layers/core-lib/node_modules/",
      "<rootDir>/../../../layers/pdf-lib/node_modules/"
    ]
  };