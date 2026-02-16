import { jest } from '@jest/globals'

import { ErrorHandler } from '../../utils/ErrorHandler.js'
import { GameError } from '../../utils/GameError.js'

function makeEvent () {
  return { reply: jest.fn() }
}

describe('ErrorHandler.handle', () => {
  test('handles GameError and updates stats/history', () => {
    const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() }
    const handler = new ErrorHandler(logger, { enableUserFeedback: false, enableLogging: true })

    const res = handler.handle(new GameError('玩家不存在', 'E1101'), { groupId: 1 })

    expect(res.success).toBe(true)
    expect(res.handled).toBe(true)
    expect(res.error).toBeInstanceOf(GameError)
    expect(handler.getStats().total).toBe(1)
    expect(handler.getHistory(10)).toHaveLength(1)
  })

  test('standardizes string error name via ErrorCodes', () => {
    const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() }
    const handler = new ErrorHandler(logger, { enableUserFeedback: false, enableLogging: false })

    const res = handler.handle('INVALID_PLAYER')

    expect(res.success).toBe(true)
    expect(res.error).toBeInstanceOf(GameError)
    expect(res.error.code).toBe('E1100')
  })

  test('standardizes unknown string as UNKNOWN_ERROR', () => {
    const handler = new ErrorHandler(console, { enableUserFeedback: false, enableLogging: false })
    const res = handler.handle('something went wrong')

    expect(res.error).toBeInstanceOf(GameError)
    expect(res.error.code).toBe('E1000')
    expect(res.error.message).toBe('something went wrong')
  })

  test('standardizes Error to GameError with originalError context', () => {
    const handler = new ErrorHandler(console, { enableUserFeedback: false, enableLogging: false })
    const res = handler.handle(new TypeError('bad type'), { foo: 1 })

    expect(res.error).toBeInstanceOf(GameError)
    expect(res.error.details.originalError).toBe('TypeError')
    expect(res.error.details.foo).toBe(1)
  })

  test('sends user feedback when e.reply exists', () => {
    const handler = new ErrorHandler(console, { enableUserFeedback: true, enableLogging: false })
    const e = makeEvent()

    const res = handler.handle(new GameError('玩家不存在', 'E1101'), {}, e)

    expect(res.userMessage).toBeTruthy()
    expect(e.reply).toHaveBeenCalled()
  })

  test('logs with severity-specific method', () => {
    const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() }
    const handler = new ErrorHandler(logger, { enableUserFeedback: false, enableLogging: true })

    handler.handle(new GameError('模块加载失败', 'E1601'))

    expect(logger.error).toHaveBeenCalled()
  })

  test('appends severity hints for HIGH/CRITICAL in user feedback', () => {
    const handler = new ErrorHandler(console, { enableUserFeedback: true, enableLogging: false })
    const e = makeEvent()

    const highRes = handler.handle(new GameError('游戏状态异常', 'E1104'), {}, e)
    expect(highRes.userMessage).toContain('请稍后重试')

    const e2 = makeEvent()
    const criticalRes = handler.handle(new GameError('模块加载失败', 'E1601'), {}, e2)
    expect(criticalRes.userMessage).toContain('请联系管理员')
  })

  test('trims history when exceeding maxErrorHistory', () => {
    const handler = new ErrorHandler(console, { enableUserFeedback: false, enableLogging: false, maxErrorHistory: 1 })
    handler.handle(new GameError('a', 'E1100'))
    handler.handle(new GameError('b', 'E1101'))
    expect(handler.getHistory(10)).toHaveLength(1)
  })

  test('falls back to MEDIUM severity when code not in ErrorCodes', () => {
    const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() }
    const handler = new ErrorHandler(logger, { enableUserFeedback: false, enableLogging: true })

    handler.handle(new GameError('x', 'E9999'))

    expect(logger.warn).toHaveBeenCalled()
  })

  test('returns success=false when error handling itself throws', () => {
    const logger = {
      // Make the "normal" logging path fail, but keep the handler's fallback logger.error usable.
      error: jest.fn(),
      warn: () => { throw new Error('logger warn') },
      info: jest.fn(),
      log: jest.fn()
    }
    const handler = new ErrorHandler(logger, { enableUserFeedback: true, enableLogging: true })
    const e = makeEvent()

    const res = handler.handle(new GameError('x', 'E1102'), {}, e)

    expect(res.success).toBe(false)
    expect(res.handled).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('系统错误，请稍后重试')
  })
})

describe('ErrorHandler.createAndHandle', () => {
  test('creates GameError from name and handles it', () => {
    const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() }
    const handler = new ErrorHandler(logger, { enableUserFeedback: false, enableLogging: false })

    const res = handler.createAndHandle('PLAYER_NOT_FOUND')
    expect(res.success).toBe(true)
    expect(res.error).toBeInstanceOf(GameError)
    expect(res.error.code).toBe('E1101')
  })

  test('falls back to handle(Error) for unknown error name', () => {
    const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() }
    const handler = new ErrorHandler(logger, { enableUserFeedback: false, enableLogging: false })

    const res = handler.createAndHandle('NOT_A_REAL_ERROR_NAME')
    expect(res.success).toBe(true)
    expect(res.error).toBeInstanceOf(GameError)
  })
})

describe('ErrorHandler history/stats utilities', () => {
  test('clearHistory and resetStats work', () => {
    const handler = new ErrorHandler(console, { enableUserFeedback: false, enableLogging: false })

    handler.handle(new GameError('x', 'E1100'))
    expect(handler.getHistory()).toHaveLength(1)
    expect(handler.getStats().total).toBe(1)

    handler.clearHistory()
    handler.resetStats()

    expect(handler.getHistory()).toHaveLength(0)
    expect(handler.getStats().total).toBe(0)
  })
})
