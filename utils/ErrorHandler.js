/**
 * @file ErrorHandler.js
 * @description 统一错误处理工具类，提供标准化的错误处理和日志记录
 * @module model/core/ErrorHandler
 *
 * @input ErrorCodes, ErrorSeverity, ErrorCategory, getErrorByName, GameError
 * @output ErrorHandler, defaultErrorHandler
 * @pos 核心层 - 统一错误处理
 *
 * @dependencies
 * - ./ErrorCodes.js - 错误代码
 * - ./GameError.js - 游戏错误类
 */
import { ErrorCodes, ErrorSeverity, ErrorCategory, getErrorByName } from './ErrorCodes.js'
import { GameError } from './GameError.js'

/**
 * 错误处理器类
 */
export class ErrorHandler {
  constructor (logger = console, options = {}) {
    this.logger = logger
    this.options = {
      enableUserFeedback: true,
      enableLogging: true,
      logLevel: 'info',
      maxErrorHistory: 100,
      ...options
    }

    // 错误历史记录
    this.errorHistory = []

    // 错误统计
    this.errorStats = {
      total: 0,
      byCategory: {},
      bySeverity: {}
    }
  }

  /**
   * 处理错误的主要方法
   * @param {Error|GameError|string} error 错误对象或错误名称
   * @param {Object} context 错误上下文信息
   * @param {Object} e 通信句柄（可选）
   * @returns {Object} 处理结果
   */
  handle (error, context = {}, e = null) {
    try {
      // 标准化错误对象
      const standardError = this._standardizeError(error, context)

      // 记录错误
      if (this.options.enableLogging) {
        this._logError(standardError, context)
      }

      // 更新统计
      this._updateStats(standardError)

      // 记录历史
      this._recordHistory(standardError, context)

      // 发送用户反馈
      let userMessage = null
      if (this.options.enableUserFeedback && e) {
        userMessage = this._sendUserFeedback(standardError, e)
      }

      return {
        success: true,
        error: standardError,
        userMessage,
        handled: true
      }
    } catch (handlingError) {
      // 错误处理过程中出错的兜底处理
      this.logger.error('ErrorHandler: 处理错误时发生异常:', handlingError)

      if (e && typeof e.reply === 'function') {
        e.reply('系统错误，请稍后重试')
      }

      return {
        success: false,
        error: handlingError,
        userMessage: '系统错误，请稍后重试',
        handled: false
      }
    }
  }

  /**
   * 创建并处理游戏错误
   * @param {string} errorName 错误名称
   * @param {string} customMessage 自定义消息（可选）
   * @param {Object} details 错误详情
   * @param {Object} context 上下文
   * @param {Object} e 通信句柄
   * @returns {Object} 处理结果
   */
  createAndHandle (errorName, customMessage = null, details = {}, context = {}, e = null) {
    const errorInfo = getErrorByName(errorName)
    if (!errorInfo) {
      return this.handle(new Error(`Unknown error: ${errorName}`), context, e)
    }

    const message = customMessage || errorInfo.message
    const gameError = new GameError(message, errorInfo.code, details)

    return this.handle(gameError, context, e)
  }

  /**
   * 标准化错误对象
   * @private
   */
  _standardizeError (error, context) {
    if (error instanceof GameError) {
      return error
    }

    if (typeof error === 'string') {
      // 尝试从错误名称创建标准错误
      const errorInfo = getErrorByName(error)
      if (errorInfo) {
        return new GameError(errorInfo.message, errorInfo.code, context)
      }
      // 创建通用错误
      return new GameError(error, ErrorCodes.UNKNOWN_ERROR.code, context)
    }

    if (error instanceof Error) {
      // 将普通错误转换为GameError
      return new GameError(error.message, ErrorCodes.UNKNOWN_ERROR.code, {
        originalError: error.name,
        stack: error.stack,
        ...context
      })
    }

    // 兜底处理
    return new GameError('未知错误', ErrorCodes.UNKNOWN_ERROR.code, context)
  }

  /**
   * 记录错误日志
   * @private
   */
  _logError (error, context) {
    const errorInfo = this._getErrorInfo(error.code)
    const severity = errorInfo?.severity || ErrorSeverity.MEDIUM

    const logData = {
      timestamp: new Date().toISOString(),
      code: error.code,
      message: error.message,
      severity,
      category: errorInfo?.category || ErrorCategory.SYSTEM,
      context,
      details: error.details
    }

    // 根据严重级别选择日志方法
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error('[CRITICAL]', logData)
        break
      case ErrorSeverity.HIGH:
        this.logger.error('[HIGH]', logData)
        break
      case ErrorSeverity.MEDIUM:
        this.logger.warn('[MEDIUM]', logData)
        break
      case ErrorSeverity.LOW:
        this.logger.info('[LOW]', logData)
        break
      default:
        this.logger.log('[UNKNOWN]', logData)
    }
  }

  /**
   * 发送用户友好的错误反馈
   * @private
   */
  _sendUserFeedback (error, e) {
    if (!e || typeof e.reply !== 'function') {
      return null
    }

    const errorInfo = this._getErrorInfo(error.code)
    let userMessage = this._getUserFriendlyMessage(error, errorInfo)

    // 根据严重级别添加不同的提示
    if (errorInfo?.severity === ErrorSeverity.CRITICAL) {
      userMessage += ' 请联系管理员。'
    } else if (errorInfo?.severity === ErrorSeverity.HIGH) {
      userMessage += ' 请稍后重试。'
    }

    e.reply(userMessage)
    return userMessage
  }

  /**
   * 获取用户友好的错误消息
   * @private
   */
  _getUserFriendlyMessage (error, errorInfo) {
    // 用户友好消息映射
    const friendlyMessages = {
      E1100: '请确认您是游戏参与者',
      E1101: '请确认游戏号码',
      E1102: '游戏人数不足，请等待更多玩家加入',
      E1103: '部分玩家未添加机器人好友，游戏无法开始',
      E1104: '游戏状态异常，请重新创建游戏',
      E1105: '玩家已存在',
      E1106: '玩家已死亡',
      E1107: '处理玩家死亡时出错',
      E1200: '当前阶段无法执行该操作',
      E1201: '游戏尚未开始或已结束',
      E1300: '投票操作失败，请检查目标是否有效',
      E1400: '警长竞选操作失败，请稍后再试',
      E1500: '守卫行动失败',
      E1501: '预言家行动失败',
      E1502: '女巫毒药使用失败',
      E1503: '女巫解药使用失败'
    }

    return friendlyMessages[error.code] || errorInfo?.message || error.message || '操作失败'
  }

  /**
   * 更新错误统计
   * @private
   */
  _updateStats (error) {
    this.errorStats.total++

    const errorInfo = this._getErrorInfo(error.code)
    if (errorInfo) {
      // 按分类统计
      const category = errorInfo.category
      this.errorStats.byCategory[category] = (this.errorStats.byCategory[category] || 0) + 1

      // 按严重级别统计
      const severity = errorInfo.severity
      this.errorStats.bySeverity[severity] = (this.errorStats.bySeverity[severity] || 0) + 1
    }
  }

  /**
   * 记录错误历史
   * @private
   */
  _recordHistory (error, context) {
    const record = {
      timestamp: new Date(),
      error: error.toJSON(),
      context
    }

    this.errorHistory.push(record)

    // 限制历史记录数量
    if (this.errorHistory.length > this.options.maxErrorHistory) {
      this.errorHistory.shift()
    }
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
   * 获取错误统计信息
   * @returns {Object} 统计信息
   */
  getStats () {
    return { ...this.errorStats }
  }

  /**
   * 获取错误历史
   * @param {number} limit 限制数量
   * @returns {Array} 错误历史记录
   */
  getHistory (limit = 10) {
    return this.errorHistory.slice(-limit)
  }

  /**
   * 清除错误历史
   */
  clearHistory () {
    this.errorHistory = []
  }

  /**
   * 重置错误统计
   */
  resetStats () {
    this.errorStats = {
      total: 0,
      byCategory: {},
      bySeverity: {}
    }
  }
}

// 创建默认的错误处理器实例
export const defaultErrorHandler = new ErrorHandler(global.logger || console)
