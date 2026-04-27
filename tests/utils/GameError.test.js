import { ErrorCategory, ErrorCodes, ErrorSeverity } from '../../utils/ErrorCodes.js'
import { GameError } from '../../utils/GameError.js'

describe('GameError', () => {
  describe('constructor', () => {
    it('should create a game error with metadata from a known error code', () => {
      const details = { playerId: 'p1' }
      const error = new GameError('玩家无效', 'E1100', details)

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(GameError)
      expect(error.name).toBe('GameError')
      expect(error.message).toBe('玩家无效')
      expect(error.code).toBe('E1100')
      expect(error.details).toBe(details)
      expect(error.timestamp).toBeInstanceOf(Date)
      expect(error.errorInfo).toBe(ErrorCodes.INVALID_PLAYER)
      expect(error.severity).toBe(ErrorSeverity.LOW)
      expect(error.category).toBe(ErrorCategory.VALIDATION)
    })

    it('should fall back to medium system metadata for unknown codes', () => {
      const error = new GameError('自定义错误', 'E9999')

      expect(error.errorInfo).toBeNull()
      expect(error.severity).toBe(ErrorSeverity.MEDIUM)
      expect(error.category).toBe(ErrorCategory.SYSTEM)
    })
  })

  describe('_getErrorInfo', () => {
    it('should return matching error info or null', () => {
      const error = new GameError('测试')

      expect(error._getErrorInfo('E1601')).toBe(ErrorCodes.MODULE_LOAD_ERROR)
      expect(error._getErrorInfo('E9999')).toBeNull()
    })
  })

  describe('message formatting', () => {
    it('should format a short message', () => {
      const error = new GameError('操作失败', 'E1200')

      expect(error.getFormattedMessage()).toBe('[E1200] 操作失败')
    })

    it('should format a detailed message with details', () => {
      const error = new GameError('操作失败', 'E1200', { action: 'vote' })

      expect(error.getDetailedMessage()).toBe(
        '[E1200] [LOW] [GAME_LOGIC] 操作失败 Details: {"action":"vote"}'
      )
    })

    it('should omit details from detailed message when details are empty', () => {
      const error = new GameError('操作失败', 'E1200')

      expect(error.getDetailedMessage()).toBe('[E1200] [LOW] [GAME_LOGIC] 操作失败')
    })
  })

  describe('type checks', () => {
    it('should check severity and category', () => {
      const error = new GameError('权限不足', 'E1800')

      expect(error.isSeverity(ErrorSeverity.LOW)).toBe(true)
      expect(error.isSeverity(ErrorSeverity.HIGH)).toBe(false)
      expect(error.isCategory(ErrorCategory.PERMISSION)).toBe(true)
      expect(error.isCategory(ErrorCategory.SYSTEM)).toBe(false)
    })

    it('should treat high and critical errors as critical', () => {
      expect(new GameError('空引用', 'E1002').isCritical()).toBe(true)
      expect(new GameError('模块失败', 'E1601').isCritical()).toBe(true)
      expect(new GameError('参数错误', 'E1001').isCritical()).toBe(false)
    })
  })

  describe('serialization', () => {
    it('should serialize complete error data', () => {
      const error = new GameError('玩家不存在', 'E1101', { playerId: 'p1' })
      const json = error.toJSON()

      expect(json).toMatchObject({
        name: 'GameError',
        message: '玩家不存在',
        code: 'E1101',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
        details: { playerId: 'p1' }
      })
      expect(json.timestamp).toBe(error.timestamp.toISOString())
      expect(json.stack).toEqual(expect.any(String))
    })
  })

  describe('clone', () => {
    it('should clone an error and merge override details', () => {
      const original = new GameError('原始错误', 'E1101', { playerId: 'p1', phase: 'day' })
      const clone = original.clone({
        message: '覆盖错误',
        code: 'E1200',
        details: { action: 'vote', phase: 'night' }
      })

      expect(clone).toBeInstanceOf(GameError)
      expect(clone).not.toBe(original)
      expect(clone.message).toBe('覆盖错误')
      expect(clone.code).toBe('E1200')
      expect(clone.details).toEqual({
        playerId: 'p1',
        phase: 'night',
        action: 'vote'
      })
    })

    it('should clone with original values when no overrides are provided', () => {
      const original = new GameError('原始错误', 'E1101', { playerId: 'p1' })
      const clone = original.clone()

      expect(clone.message).toBe(original.message)
      expect(clone.code).toBe(original.code)
      expect(clone.details).toEqual(original.details)
    })
  })

  describe('factory methods', () => {
    it('should create a GameError from a native error and preserve stack data', () => {
      const nativeError = new TypeError('类型错误')
      nativeError.stack = 'TypeError: 类型错误\n    at test'
      const error = GameError.fromError(nativeError, 'E1600', { module: 'browser' })

      expect(error).toBeInstanceOf(GameError)
      expect(error.message).toBe('类型错误')
      expect(error.code).toBe('E1600')
      expect(error.details).toMatchObject({
        originalName: 'TypeError',
        originalStack: nativeError.stack,
        module: 'browser'
      })
      expect(error.stack).toBe(nativeError.stack)
    })

    it('should create a GameError from a known error name', () => {
      const defaultError = GameError.fromErrorName('INVALID_PLAYER')
      const customError = GameError.fromErrorName('INVALID_PLAYER', '自定义玩家错误', { playerId: 'p1' })

      expect(defaultError.message).toBe(ErrorCodes.INVALID_PLAYER.message)
      expect(defaultError.code).toBe(ErrorCodes.INVALID_PLAYER.code)
      expect(customError.message).toBe('自定义玩家错误')
      expect(customError.details).toEqual({ playerId: 'p1' })
    })

    it('should throw when creating from an unknown error name', () => {
      expect(() => GameError.fromErrorName('NO_SUCH_ERROR')).toThrow('Unknown error name: NO_SUCH_ERROR')
    })
  })
})
