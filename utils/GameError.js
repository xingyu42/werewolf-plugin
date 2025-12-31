/**
 * @file GameError.js
 * @description 游戏错误类，提供错误码和详细信息
 * @module model/core/GameError
 *
 * @input ErrorCodes, ErrorSeverity, ErrorCategory
 * @output GameError - 游戏错误类
 * @pos 核心层 - 错误封装
 *
 * @dependencies
 * - ./ErrorCodes.js - 错误代码定义
 */
import { ErrorCodes, ErrorSeverity, ErrorCategory } from './ErrorCodes.js'

export class GameError extends Error {
  /**
   * 创建游戏错误
   * @param {string} message 错误消息
   * @param {string} code 错误代码
   * @param {Object} details 错误详情
   */
  constructor (message, code = 'E1000', details = {}) {
    super(message)
    this.name = 'GameError'
    this.code = code
    this.details = details
    this.timestamp = new Date()

    // 从错误代码获取额外信息
    this.errorInfo = this._getErrorInfo(code)
    this.severity = this.errorInfo?.severity || ErrorSeverity.MEDIUM
    this.category = this.errorInfo?.category || ErrorCategory.SYSTEM
  }

  /**
   * 获取错误信息
   * @private
   */
  _getErrorInfo (code) {
    for (const errorInfo of Object.values(ErrorCodes)) {
      if (errorInfo.code === code) {
        return errorInfo
      }
    }
    return null
  }

  /**
   * 获取格式化的错误信息
   * @returns {string} 格式化的错误信息
   */
  getFormattedMessage () {
    return `[${this.code}] ${this.message}`
  }

  /**
   * 获取详细的格式化错误信息
   * @returns {string} 详细的格式化错误信息
   */
  getDetailedMessage () {
    const parts = [
      `[${this.code}]`,
      `[${this.severity.toUpperCase()}]`,
      `[${this.category.toUpperCase()}]`,
      this.message
    ]

    if (this.details && Object.keys(this.details).length > 0) {
      parts.push(`Details: ${JSON.stringify(this.details)}`)
    }

    return parts.join(' ')
  }

  /**
   * 检查是否为指定严重级别
   * @param {string} severity 严重级别
   * @returns {boolean}
   */
  isSeverity (severity) {
    return this.severity === severity
  }

  /**
   * 检查是否为指定分类
   * @param {string} category 错误分类
   * @returns {boolean}
   */
  isCategory (category) {
    return this.category === category
  }

  /**
   * 检查是否为严重错误（HIGH或CRITICAL级别）
   * @returns {boolean}
   */
  isCritical () {
    return this.severity === ErrorSeverity.HIGH || this.severity === ErrorSeverity.CRITICAL
  }

  /**
   * 获取错误的完整信息（用于日志）
   * @returns {Object} 完整的错误信息对象
   */
  toJSON () {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      category: this.category,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    }
  }

  /**
   * 创建错误的副本
   * @param {Object} overrides 要覆盖的属性
   * @returns {GameError} 新的错误实例
   */
  clone (overrides = {}) {
    const newDetails = { ...this.details, ...overrides.details }
    const newError = new GameError(
      overrides.message || this.message,
      overrides.code || this.code,
      newDetails
    )

    return newError
  }

  /**
   * 从普通错误创建GameError
   * @param {Error} error 普通错误对象
   * @param {string} code 错误代码
   * @param {Object} details 额外详情
   * @returns {GameError}
   */
  static fromError (error, code = 'E1000', details = {}) {
    const gameError = new GameError(error.message, code, {
      originalName: error.name,
      originalStack: error.stack,
      ...details
    })

    // 保留原始堆栈信息
    if (error.stack) {
      gameError.stack = error.stack
    }

    return gameError
  }

  /**
   * 从错误名称创建GameError
   * @param {string} errorName 错误名称（如 'INVALID_PLAYER'）
   * @param {string} customMessage 自定义消息
   * @param {Object} details 错误详情
   * @returns {GameError}
   */
  static fromErrorName (errorName, customMessage = null, details = {}) {
    const errorInfo = ErrorCodes[errorName]
    if (!errorInfo) {
      throw new Error(`Unknown error name: ${errorName}`)
    }

    const message = customMessage || errorInfo.message
    return new GameError(message, errorInfo.code, details)
  }
}
