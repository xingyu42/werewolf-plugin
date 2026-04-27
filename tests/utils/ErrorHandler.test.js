import { jest } from '@jest/globals'
import { ErrorCategory, ErrorSeverity } from '../../utils/ErrorCodes.js'
import { GameError } from '../../utils/GameError.js'
import { ErrorHandler, defaultErrorHandler } from '../../utils/ErrorHandler.js'

const createLogger = () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  log: jest.fn()
})

describe('ErrorHandler', () => {
  let logger
  let handler

  beforeEach(() => {
    logger = createLogger()
    handler = new ErrorHandler(logger)
  })

  describe('constructor', () => {
    it('should create handler with defaults and custom options', () => {
      const customHandler = new ErrorHandler(logger, {
        enableLogging: false,
        maxErrorHistory: 2
      })

      expect(customHandler.logger).toBe(logger)
      expect(customHandler.options).toMatchObject({
        enableUserFeedback: true,
        enableLogging: false,
        logLevel: 'info',
        maxErrorHistory: 2
      })
      expect(customHandler.getStats()).toEqual({
        total: 0,
        byCategory: {},
        bySeverity: {}
      })
      expect(customHandler.getHistory()).toEqual([])
    })

    it('should export a default handler instance', () => {
      expect(defaultErrorHandler).toBeInstanceOf(ErrorHandler)
    })
  })

  describe('handle', () => {
    it('should standardize, log, track, record, and reply to a GameError', () => {
      const error = new GameError('人数不足', 'E1102', { current: 3 })
      const context = { roomId: 'r1' }
      const e = { reply: jest.fn() }

      const result = handler.handle(error, context, e)

      expect(result).toMatchObject({
        success: true,
        error,
        userMessage: '游戏人数不足，请等待更多玩家加入',
        handled: true
      })
      expect(logger.warn).toHaveBeenCalledWith('[MEDIUM]', expect.objectContaining({
        code: 'E1102',
        message: '人数不足',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.VALIDATION,
        context,
        details: { current: 3 }
      }))
      expect(e.reply).toHaveBeenCalledWith('游戏人数不足，请等待更多玩家加入')
      expect(handler.getStats()).toEqual({
        total: 1,
        byCategory: { [ErrorCategory.VALIDATION]: 1 },
        bySeverity: { [ErrorSeverity.MEDIUM]: 1 }
      })
      expect(handler.getHistory(1)[0]).toMatchObject({
        context,
        error: expect.objectContaining({
          code: 'E1102',
          message: '人数不足'
        })
      })
    })

    it('should skip logging and feedback when disabled', () => {
      const quietHandler = new ErrorHandler(logger, {
        enableLogging: false,
        enableUserFeedback: false
      })
      const e = { reply: jest.fn() }

      const result = quietHandler.handle('INVALID_PLAYER', { userId: 'u1' }, e)

      expect(result.success).toBe(true)
      expect(result.userMessage).toBeNull()
      expect(result.error).toBeInstanceOf(GameError)
      expect(result.error.code).toBe('E1100')
      expect(logger.error).not.toHaveBeenCalled()
      expect(logger.warn).not.toHaveBeenCalled()
      expect(logger.info).not.toHaveBeenCalled()
      expect(e.reply).not.toHaveBeenCalled()
      expect(quietHandler.getStats().total).toBe(1)
    })

    it('should return fallback result when handling itself fails', () => {
      const e = { reply: jest.fn() }
      handler._standardizeError = () => {
        throw new Error('standardize failed')
      }

      const result = handler.handle('INVALID_PLAYER', {}, e)

      expect(result.success).toBe(false)
      expect(result.handled).toBe(false)
      expect(result.error.message).toBe('standardize failed')
      expect(result.userMessage).toBe('系统错误，请稍后重试')
      expect(logger.error).toHaveBeenCalledWith(
        'ErrorHandler: 处理错误时发生异常:',
        expect.any(Error)
      )
      expect(e.reply).toHaveBeenCalledWith('系统错误，请稍后重试')
    })
  })

  describe('createAndHandle', () => {
    it('should create and handle a known named error', () => {
      const result = handler.createAndHandle(
        'INVALID_PLAYER',
        '自定义玩家错误',
        { playerId: 'p1' },
        { action: 'join' }
      )

      expect(result.success).toBe(true)
      expect(result.error).toBeInstanceOf(GameError)
      expect(result.error.message).toBe('自定义玩家错误')
      expect(result.error.code).toBe('E1100')
      expect(result.error.details).toEqual({ playerId: 'p1' })
      expect(logger.info).toHaveBeenCalledWith('[LOW]', expect.objectContaining({
        code: 'E1100'
      }))
    })

    it('should handle unknown named errors as native errors', () => {
      const result = handler.createAndHandle('MISSING_ERROR')

      expect(result.success).toBe(true)
      expect(result.error).toBeInstanceOf(GameError)
      expect(result.error.code).toBe('E1000')
      expect(result.error.message).toBe('Unknown error: MISSING_ERROR')
    })
  })

  describe('_standardizeError', () => {
    it('should return GameError instances unchanged', () => {
      const error = new GameError('已存在', 'E1105')

      expect(handler._standardizeError(error, {})).toBe(error)
    })

    it('should convert strings by error name or raw message', () => {
      const namedError = handler._standardizeError('PLAYER_NOT_FOUND', { playerId: 'p1' })
      const rawError = handler._standardizeError('raw failure', { source: 'test' })

      expect(namedError).toMatchObject({
        message: '玩家不存在',
        code: 'E1101',
        details: { playerId: 'p1' }
      })
      expect(rawError).toMatchObject({
        message: 'raw failure',
        code: 'E1000',
        details: { source: 'test' }
      })
    })

    it('should convert native errors and unknown values', () => {
      const native = new TypeError('boom')
      const nativeError = handler._standardizeError(native, { phase: 'night' })
      const unknownError = handler._standardizeError({ reason: 'bad' }, { phase: 'day' })

      expect(nativeError).toBeInstanceOf(GameError)
      expect(nativeError.code).toBe('E1000')
      expect(nativeError.details).toMatchObject({
        originalError: 'TypeError',
        phase: 'night'
      })
      expect(nativeError.details.stack).toEqual(expect.any(String))
      expect(unknownError).toMatchObject({
        message: '未知错误',
        code: 'E1000',
        details: { phase: 'day' }
      })
    })
  })

  describe('_logError', () => {
    it('should route logs by severity', () => {
      handler._logError(new GameError('critical', 'E1601'), { case: 'critical' })
      handler._logError(new GameError('high', 'E1002'), { case: 'high' })
      handler._logError(new GameError('medium', 'E1000'), { case: 'medium' })
      handler._logError(new GameError('low', 'E1100'), { case: 'low' })

      expect(logger.error).toHaveBeenNthCalledWith(1, '[CRITICAL]', expect.objectContaining({
        code: 'E1601',
        severity: ErrorSeverity.CRITICAL
      }))
      expect(logger.error).toHaveBeenNthCalledWith(2, '[HIGH]', expect.objectContaining({
        code: 'E1002',
        severity: ErrorSeverity.HIGH
      }))
      expect(logger.warn).toHaveBeenCalledWith('[MEDIUM]', expect.objectContaining({
        code: 'E1000',
        severity: ErrorSeverity.MEDIUM
      }))
      expect(logger.info).toHaveBeenCalledWith('[LOW]', expect.objectContaining({
        code: 'E1100',
        severity: ErrorSeverity.LOW
      }))
    })

    it('should use logger.log for unknown severity values', () => {
      handler._getErrorInfo = () => ({
        severity: 'custom',
        category: 'custom'
      })

      handler._logError(new GameError('custom', 'E9999'), {})

      expect(logger.log).toHaveBeenCalledWith('[UNKNOWN]', expect.objectContaining({
        code: 'E9999',
        severity: 'custom',
        category: 'custom'
      }))
    })
  })

  describe('_sendUserFeedback and friendly messages', () => {
    it('should return null when reply handle is missing or invalid', () => {
      expect(handler._sendUserFeedback(new GameError('玩家错误', 'E1100'), null)).toBeNull()
      expect(handler._sendUserFeedback(new GameError('玩家错误', 'E1100'), {})).toBeNull()
    })

    it('should append retry or admin hint for high and critical severities', () => {
      const highReply = { reply: jest.fn() }
      const criticalReply = { reply: jest.fn() }

      expect(handler._sendUserFeedback(new GameError('空引用', 'E1002'), highReply)).toBe('空引用错误 请稍后重试。')
      expect(handler._sendUserFeedback(new GameError('模块失败', 'E1601'), criticalReply)).toBe('模块加载失败 请联系管理员。')
      expect(highReply.reply).toHaveBeenCalledWith('空引用错误 请稍后重试。')
      expect(criticalReply.reply).toHaveBeenCalledWith('模块加载失败 请联系管理员。')
    })

    it('should use mapped, error info, error message, and final fallback messages', () => {
      expect(handler._getUserFriendlyMessage(new GameError('玩家错误', 'E1100'), null)).toBe('请确认您是游戏参与者')
      expect(handler._getUserFriendlyMessage(new GameError('猎人错误', 'E1504'), handler._getErrorInfo('E1504'))).toBe('猎人开枪失败')
      expect(handler._getUserFriendlyMessage(new GameError('自定义错误', 'E9999'), null)).toBe('自定义错误')
      expect(handler._getUserFriendlyMessage(new GameError('', 'E9999'), null)).toBe('操作失败')
    })
  })

  describe('stats and history', () => {
    it('should limit history and return the most recent records', () => {
      const limitedHandler = new ErrorHandler(logger, { maxErrorHistory: 2, enableLogging: false })

      limitedHandler.handle(new GameError('one', 'E1100'), { index: 1 })
      limitedHandler.handle(new GameError('two', 'E1200'), { index: 2 })
      limitedHandler.handle(new GameError('three', 'E1601'), { index: 3 })

      expect(limitedHandler.getHistory(10)).toHaveLength(2)
      expect(limitedHandler.getHistory(1)[0].context).toEqual({ index: 3 })
      expect(limitedHandler.getHistory(10).map(record => record.error.message)).toEqual(['two', 'three'])
    })

    it('should clear history and reset stats', () => {
      handler.handle(new GameError('玩家错误', 'E1100'))
      handler.handle(new GameError('未知编码', 'E9999'))

      expect(handler.getStats().total).toBe(2)
      expect(handler.getStats().byCategory).toEqual({ [ErrorCategory.VALIDATION]: 1 })
      expect(handler.getHistory()).toHaveLength(2)

      handler.clearHistory()
      handler.resetStats()

      expect(handler.getHistory()).toEqual([])
      expect(handler.getStats()).toEqual({
        total: 0,
        byCategory: {},
        bySeverity: {}
      })
    })
  })
})
