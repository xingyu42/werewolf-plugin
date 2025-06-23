/**
 * Jest 配置文件 - 现代化版本
 * 基于 Jest 29.x 最佳实践，支持 ES 模块和现代化功能
 * @type {import('jest').Config}
 */
export default {
  // 测试环境
  testEnvironment: 'node',

  // ES 模块支持 - 禁用 Babel 转换，直接使用 Node.js ES 模块
  preset: null,
  transform: {},
  // extensionsToTreatAsEsm: ['.js'], // 不需要，package.json已设置"type": "module"

  // 模块解析 - 处理 ES 模块的 .js 扩展名
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // 测试文件匹配模式
  testMatch: [
    '**/tests/**/*.test.js'
  ],

  // 忽略的目录
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/'
  ],

  // 设置文件 - 在测试框架安装后运行
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],

  // 覆盖率配置
  collectCoverage: false, // 按需开启
  collectCoverageFrom: [
    'model/**/*.js',
    'components/**/*.js',
    'apps/**/*.js',
    '!**/*.test.js',
    '!**/node_modules/**',
    '!coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },

  // 性能和执行配置
  testTimeout: 10000,
  maxWorkers: '50%', // 使用50%的CPU核心，平衡性能和资源使用
  workerIdleMemoryLimit: '512MB', // 限制worker内存使用
  
  // 输出和报告配置
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  
  // 错误处理
  bail: false, // 不在第一个失败时停止
  errorOnDeprecated: true, // 使用废弃API时报错
    
  // 高级配置
  detectOpenHandles: true, // 检测未关闭的异步句柄
  forceExit: false // 让Jest正常退出
  
  // 可选：自定义报告器（按需启用）
  // reporters: ['default', 'jest-junit'],
  
  // 可选：并行测试配置
  // testSequencer: '<rootDir>/custom-sequencer.js'
}
