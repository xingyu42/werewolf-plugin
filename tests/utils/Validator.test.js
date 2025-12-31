import { jest } from '@jest/globals'

// Validator defines `static errorHandler = new ErrorHandler(global.logger || console)` at import time.
// Keep a stable logger to avoid noisy output during tests.
global.logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn()
}

const { ValidationUtils } = await import('../../utils/Validator.js')
const { GameError } = await import('../../utils/GameError.js')

describe('ValidationUtils.validatePlayer', () => {
  test('rejects null player', () => {
    const res = ValidationUtils.validatePlayer(null)
    expect(res.isValid).toBe(false)
    expect(res.error).toBeInstanceOf(GameError)
    expect(res.error.code).toBe('E1101')
  })

  test('rejects non-object player', () => {
    const res = ValidationUtils.validatePlayer('x')
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1100')
  })

  test('rejects when missing required properties', () => {
    const res = ValidationUtils.validatePlayer({}, { checkAlive: true })
    expect(res.isValid).toBe(false)
    expect(res.error.message).toContain('缺少必要属性')
  })

  test('rejects dead player when checkAlive', () => {
    const res = ValidationUtils.validatePlayer({ id: 1, isAlive: false }, { checkAlive: true })
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1103')
  })

  test('rejects when isAlive is not boolean under checkAlive', () => {
    const res = ValidationUtils.validatePlayer({ id: 1, isAlive: 'yes' }, { checkAlive: true })
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1100')
  })

  test('rejects role mismatch when requiredRole is set', () => {
    const res = ValidationUtils.validatePlayer({ id: 1, role: 'A' }, { checkRole: true, requiredRole: 'B' })
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1402')
  })
})

describe('ValidationUtils.validateGameState', () => {
  class AllowedState {}

  test('rejects when game is null', () => {
    const res = ValidationUtils.validateGameState(null)
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1201')
  })

  test('rejects when stateMachine is invalid', () => {
    const res = ValidationUtils.validateGameState({ stateMachine: {} })
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1203')
  })

  test('rejects when current state is null', () => {
    const res = ValidationUtils.validateGameState({ stateMachine: { getCurrentState: () => null } })
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1201')
  })

  test('rejects when state not in allowed list', () => {
    const res = ValidationUtils.validateGameState(
      { stateMachine: { getCurrentState: () => ({}) } },
      [AllowedState]
    )
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1200')
  })

  test('accepts when current state is allowed', () => {
    const current = new AllowedState()
    const res = ValidationUtils.validateGameState(
      { stateMachine: { getCurrentState: () => current } },
      [AllowedState]
    )
    expect(res.isValid).toBe(true)
  })
})

describe('ValidationUtils.validateTarget', () => {
  test('accepts valid target without custom validator', () => {
    const target = { id: 2, isAlive: true }
    const res = ValidationUtils.validateTarget(target)
    expect(res.isValid).toBe(true)
  })

  test('accepts when custom validator returns true', () => {
    const target = { id: 2, isAlive: true }
    const res = ValidationUtils.validateTarget(target, () => true)
    expect(res.isValid).toBe(true)
  })

  test('rejects when custom validator returns false', () => {
    const target = { id: 2, isAlive: true }
    const res = ValidationUtils.validateTarget(target, () => false)
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1301')
  })

  test('rejects when custom validator throws', () => {
    const target = { id: 2, isAlive: true }
    const res = ValidationUtils.validateTarget(target, () => { throw new Error('boom') })
    expect(res.isValid).toBe(false)
    expect(res.error.message).toContain('目标验证器执行失败')
  })
})

describe('ValidationUtils.validateAction', () => {
  test('rejects invalid action parameter', () => {
    const res = ValidationUtils.validateAction({ id: 1, isAlive: true }, null)
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1200')
  })

  test('rejects when current state disallows action', () => {
    const game = {
      stateMachine: {
        getCurrentState: () => ({
          isValidAction: () => false
        })
      }
    }

    const res = ValidationUtils.validateAction(
      { id: 1, isAlive: true, role: 'X' },
      'vote',
      { game, allowedStates: [], requiredRole: null, checkAlive: true }
    )
    expect(res.isValid).toBe(false)
    expect(res.error.message).toContain('当前状态不允许此行动')
  })

  test('rejects role mismatch when requiredRole provided', () => {
    const res = ValidationUtils.validateAction(
      { id: 1, isAlive: true, role: 'A' },
      'vote',
      { requiredRole: 'B', checkAlive: true }
    )
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1402')
  })

  test('rejects when validateGameState fails (allowedStates mismatch)', () => {
    class AllowedState {}
    const game = { stateMachine: { getCurrentState: () => ({}) } }
    const res = ValidationUtils.validateAction(
      { id: 1, isAlive: true },
      'vote',
      { game, allowedStates: [AllowedState] }
    )
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1200')
  })
})

describe('ValidationUtils.validateGamePlayer / validateRole', () => {
  test('validateGamePlayer rejects invalid inputs', () => {
    expect(ValidationUtils.validateGamePlayer(null, 'u1').isValid).toBe(false)
    expect(ValidationUtils.validateGamePlayer({ players: {} }, 'u1').isValid).toBe(false)
    expect(ValidationUtils.validateGamePlayer({ players: new Map() }, '').isValid).toBe(false)
    expect(ValidationUtils.validateGamePlayer({ players: new Map() }, 'u1').isValid).toBe(false)
  })

  test('validateGamePlayer returns player when present', () => {
    const player = { id: 'u1' }
    const game = { players: new Map([['u1', player]]) }
    const res = ValidationUtils.validateGamePlayer(game, 'u1')
    expect(res.isValid).toBe(true)
    expect(res.player).toBe(player)
  })

  test('validateRole checks expectedRole', () => {
    class SomeRole {}
    const role = new SomeRole()
    const game = {
      players: new Map([['u1', { id: 'u1' }]]),
      roles: new Map([['u1', role]])
    }

    const mismatch = ValidationUtils.validateRole(game, 'u1', 'OtherRole')
    expect(mismatch.isValid).toBe(false)
    expect(mismatch.error.code).toBe('E1402')

    const ok = ValidationUtils.validateRole(game, 'u1', 'SomeRole')
    expect(ok.isValid).toBe(true)
    expect(ok.role).toBe(role)
  })

  test('validateRole succeeds when expectedRole is not provided', () => {
    class SomeRole {}
    const role = new SomeRole()
    const game = {
      players: new Map([['u1', { id: 'u1' }]]),
      roles: new Map([['u1', role]])
    }
    const res = ValidationUtils.validateRole(game, 'u1')
    expect(res.isValid).toBe(true)
    expect(res.role).toBe(role)
  })

  test('validateRole rejects when role storage is invalid or missing role', () => {
    const game = { players: new Map([['u1', { id: 'u1' }]]), roles: {} }
    expect(ValidationUtils.validateRole(game, 'u1').isValid).toBe(false)

    const game2 = { players: new Map([['u1', { id: 'u1' }]]), roles: new Map() }
    expect(ValidationUtils.validateRole(game2, 'u1').isValid).toBe(false)
  })
})

describe('ValidationUtils.validateGameNumber / validateVoteTarget / validateBatch', () => {
  test('validateGameNumber enforces type and range', () => {
    expect(ValidationUtils.validateGameNumber('1').isValid).toBe(false)
    expect(ValidationUtils.validateGameNumber(0, 1, 3).isValid).toBe(false)
    expect(ValidationUtils.validateGameNumber(2, 1, 3).isValid).toBe(true)
  })

  test('validateVoteTarget enforces self-vote rule', () => {
    const voter = { id: 1, isAlive: true }
    const target = { id: 1, isAlive: true }

    const res = ValidationUtils.validateVoteTarget(voter, target, { allowSelfVote: false })
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1300')
  })

  test('validateVoteTarget rejects dead target', () => {
    const voter = { id: 1, isAlive: true }
    const target = { id: 2, isAlive: false }
    const res = ValidationUtils.validateVoteTarget(voter, target)
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1300')
  })

  test('validateVoteTarget rejects invalid voter', () => {
    const res = ValidationUtils.validateVoteTarget(null, { id: 2, isAlive: true })
    expect(res.isValid).toBe(false)
    expect(res.error.code).toBe('E1101')
  })

  test('validateBatch aggregates errors and handles exceptions', () => {
    const res1 = ValidationUtils.validateBatch([
      () => ({ isValid: true }),
      () => ({ isValid: false, error: new GameError('x', 'E1001') })
    ])
    expect(res1.isValid).toBe(false)
    expect(res1.errors).toHaveLength(1)
    expect(res1.errors[0].code).toBe('E1001')

    const res2 = ValidationUtils.validateBatch([() => { throw new Error('boom') }])
    expect(res2.isValid).toBe(false)
    expect(res2.errors[0]).toBeInstanceOf(GameError)
  })

  test('validateBatch ignores non-function validators', () => {
    const res = ValidationUtils.validateBatch([null, 123, 'x'])
    expect(res.isValid).toBe(true)
    expect(res.errors).toEqual([])
  })

  test('validateBatch ignores invalid results without error field', () => {
    const res = ValidationUtils.validateBatch([() => ({ isValid: false })])
    expect(res.isValid).toBe(true)
    expect(res.errors).toEqual([])
  })
})
