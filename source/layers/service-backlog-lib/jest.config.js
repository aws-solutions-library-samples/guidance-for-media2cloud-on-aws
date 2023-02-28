module.exports = {
    transform: {
      '^.+\\.jsx?$': 'babel-jest',
    },
    roots: ['<rootDir>'],
    testMatch: ['**/*.spec.js'],
    coverageDirectory: "../../test/coverage-reports/jest/layers/service-backlog-lib/",
    coverageReporters: [['lcov', { projectRoot: '../../' }], 'text'],
    setupFiles: ['<rootDir>/setEnvVars.js']
};