/**
 * Jest 配置文件 - 环境自适应版本
 * 基于 Jest 29.x 最佳实践，支持 ES 模块和跨平台环境优化
 * @type {import('jest').Config}
 */

import { EnvironmentDetector } from './tests/helpers/EnvironmentDetector.js'

// 获取环境优化建议
const envConfig = EnvironmentDetector.getJestConfigRecommendations()
const envInfo = EnvironmentDetector.getEnvironmentInfo()

// 输出环境信息用于调试
if (process.env.JEST_VERBOSE || process.env.NODE_ENV === 'development') {
  console.log(`📊 Jest Environment: ${envInfo}`)
  console.log(`⚙️  Optimized Config: maxWorkers=${envConfig.maxWorkers}, memory=${envConfig.workerIdleMemoryLimit}, timeout=${envConfig.testTimeout}ms`)
}

export default {
  // 测试环境
  testEnvironment: 'node',

  // ES 模块支持 - 禁用 Babel 转换，直接使用 Node.js ES 模块
  preset: null,
  transform: {},
  // extensionsToTreatAsEsm: ['.js'], // 不需要，package.json已设置"type": "module"

  // 模块解析 - 处理 ES 模块的 .js 扩展名 + 测试隔离
  moduleNameMapper: {
    // 测试环境依赖隔离 - 将生产模块映射到Mock，保持生产代码纯净
    '^.*configurators/RoleConfigurator\\.js$': '<rootDir>/tests/__mocks__/RoleConfigurator.js',
    '^.*components/services\\.js$': '<rootDir>/tests/__mocks__/services.js',
    // ES模块扩展名处理
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // 测试文件匹配模式 - 支持分层目录结构
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
    '**/tests/system/**/*.test.js',
    '**/tests/**/*.test.js' // 保持向后兼容
  ],

  // 忽略的目录
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/'
  ],

  // 设置文件 - 在测试框架安装后运行
  setupFilesAfterEnv: [
    '<rootDir>/tests/helpers/setup.js'
  ],

  // 覆盖率配置 - 分层质量标准
  collectCoverage: false, // 按需开启
  collectCoverageFrom: [
    'model/**/*.js',
    'components/**/*.js',
    'apps/**/*.js',
    // 排除测试和Mock文件
    '!**/*.test.js',
    '!**/*Mock*.js',
    '!**/mock*.js',
    '!tests/**',
    '!**/node_modules/**',
    '!coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary', 'json'],
  
  // 分层覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 60,     // 全局分支覆盖率60%
      functions: 65,    // 全局函数覆盖率65%
      lines: 70,        // 全局行覆盖率70%
      statements: 70    // 全局语句覆盖率70%
    },
    // 核心业务逻辑 - 更高标准
    'model/core/*.js': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // 管理器层 - 中等标准
    'model/managers/*.js': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // 服务层 - 基本标准
    'model/services/*.js': {
      branches: 65,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // 性能和执行配置 - 环境自适应
  testTimeout: envConfig.testTimeout, // 根据环境动态调整超时时间
  maxWorkers: envConfig.maxWorkers, // 根据CPU核心数和环境优化
  workerIdleMemoryLimit: envConfig.workerIdleMemoryLimit, // 根据系统内存动态调整
  
  // 输出和报告配置 - 环境自适应
  verbose: envConfig.verbose, // CI环境启用详细输出
  clearMocks: true,
  restoreMocks: true,
  
  // 错误处理
  bail: false, // 不在第一个失败时停止
  errorOnDeprecated: true, // 使用废弃API时报错
    
  // 高级配置 - 环境优化
  detectOpenHandles: envConfig.detectOpenHandles, // 非CI环境检测句柄泄露
  forceExit: envConfig.forceExit, // CI和WSL环境强制退出
  
  // 可选：自定义报告器（按需启用）
  // reporters: ['default', 'jest-junit'],
  
  // 可选：并行测试配置
  // testSequencer: '<rootDir>/custom-sequencer.js'
}
