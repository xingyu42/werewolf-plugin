import { GameError } from '../../utils/GameError.js'
import { ErrorCategory, ErrorSeverity } from '../../utils/ErrorCodes.js'

describe('GameError', () => {
  test('sets code, severity, category, and formats messages', () => {
    const err = new GameError('玩家不存在', 'E1101', { foo: 1 })
    expect(err.code).toBe('E1101')
    expect(err.severity).toBe(ErrorSeverity.LOW)
    expect(err.category).toBe(ErrorCategory.VALIDATION)
    expect(err.getFormattedMessage()).toContain('[E1101]')
    expect(err.getDetailedMessage()).toContain('Details:')
  })

  test('detailed message omits details when empty', () => {
    const err = new GameError('x', 'E1101')
    expect(err.getDetailedMessage()).not.toContain('Details:')
  })

  test('severity/category checks and critical check', () => {
    const low = new GameError('x', 'E1100')
    expect(low.isSeverity(ErrorSeverity.LOW)).toBe(true)
    expect(low.isCategory(ErrorCategory.VALIDATION)).toBe(true)
    expect(low.isCritical()).toBe(false)

    const critical = new GameError('x', 'E1601')
    expect(critical.isCritical()).toBe(true)

    const high = new GameError('x', 'E1104')
    expect(high.isCritical()).toBe(true)
  })

  test('toJSON includes timestamp and stack', () => {
    const err = new GameError('x', 'E1000')
    const json = err.toJSON()
    expect(json.code).toBe('E1000')
    expect(json.timestamp).toContain('T')
    expect(json.stack).toBeTruthy()
  })

  test('clone merges details and overrides message/code', () => {
    const err = new GameError('x', 'E1101', { a: 1 })
    const copy = err.clone({ message: 'y', code: 'E1100', details: { b: 2 } })
    expect(copy.message).toBe('y')
    expect(copy.code).toBe('E1100')
    expect(copy.details).toEqual({ a: 1, b: 2 })
  })

  test('fromError preserves original stack', () => {
    const base = new Error('boom')
    base.stack = 'STACK'
    const err = GameError.fromError(base, 'E1000', { x: 1 })
    expect(err.details.originalName).toBe('Error')
    expect(err.stack).toBe('STACK')
    expect(err.details.x).toBe(1)
  })

  test('fromError works when error has no stack', () => {
    const base = new Error('boom')
    base.stack = undefined
    const err = GameError.fromError(base, 'E1000')
    expect(err.details.originalStack).toBe(undefined)
  })

  test('fromErrorName creates based on ErrorCodes', () => {
    const err = GameError.fromErrorName('PLAYER_NOT_FOUND')
    expect(err.code).toBe('E1101')
  })

  test('fromErrorName throws for unknown name', () => {
    expect(() => GameError.fromErrorName('NOT_EXISTS')).toThrow()
  })
})
