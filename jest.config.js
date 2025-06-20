/**
 * Jest 配置文件
 * 支持 ES 模块和狼人杀插件测试环境
 */

export default {
  // 基本配置
  testEnvironment: 'node',

  // ES 模块支持
  preset: null,
  globals: {
    __TEST_ENV__: true
  },
  transform: {},

  // 模块解析
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // 测试文件匹配
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // 忽略的文件和目录
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // 覆盖率配置
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json'
  ],

  // 覆盖率收集范围
  collectCoverageFrom: [
    'model/**/*.js',
    'apps/**/*.js',
    'components/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**',
    '!**/dist/**'
  ],

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // 设置文件
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],

  // 测试超时
  testTimeout: 10000,

  // 详细输出
  verbose: true,

  // 清除模拟
  clearMocks: true,
  restoreMocks: true,

  // 错误处理
  errorOnDeprecated: true,

  // 模块目录
  moduleDirectories: [
    'node_modules',
    '<rootDir>'
  ],

  // 模块文件扩展名
  moduleFileExtensions: [
    'js',
    'json'
  ],

  // 测试结果处理器
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage',
      filename: 'test-report.html',
      expand: true
    }]
  ]
}
