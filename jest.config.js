export default {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'models/*.js',
    'utils/*.js',
    '!models/roles/**',
    '!models/states/**',
    '!models/PhaseCoordinator.js',
    '!models/PhaseManager.js',
    '!models/PlayerStats.js',
    '!models/StateCallback.js',
    '!utils/configurators/**',
    '!utils/Data.js',
    '!utils/Puppeteer.js',
    '!utils/YamlReader.js',
    '!utils/GameConfig.js',
    '!utils/PlayerStats.js',
    '!utils/constants.js',
    '!utils/index.js',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 90,
      statements: 90
    }
  }
}
