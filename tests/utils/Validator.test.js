import { jest } from '@jest/globals'
import { GameError } from '../../utils/GameError.js'
import { ValidationUtils, Validator } from '../../utils/Validator.js'

const createPlayer = (overrides = {}) => ({
  id: 'p1',
  isAlive: true,
  role: 'WOLF',
  ...overrides
})

const expectInvalid = (result, code) => {
  expect(result.isValid).toBe(false)
  expect(result.error).toBeInstanceOf(GameError)
  expect(result.error.code).toBe(code)
}

const makeGameWithState = state => ({
  stateMachine: {
    getCurrentState: jest.fn(() => state)
  }
})

describe('Validator', () => {
  it('should export ValidationUtils as Validator', () => {
    expect(ValidationUtils).toBe(Validator)
  })

  describe('validatePlayer', () => {
    it('should validate a minimal player and a fully checked player', () => {
      expect(Validator.validatePlayer({ id: 'p1' })).toEqual({ isValid: true })
      expect(Validator.validatePlayer(createPlayer(), {
        checkAlive: true,
        checkRole: true,
        requiredRole: 'WOLF'
      })).toEqual({ isValid: true })
    })

    it('should reject null and non-object players', () => {
      expectInvalid(Validator.validatePlayer(null), 'E1101')
      expectInvalid(Validator.validatePlayer('p1'), 'E1100')
    })

    it('should reject missing required properties', () => {
      expectInvalid(Validator.validatePlayer({ name: 'missing id' }), 'E1100')
      expectInvalid(Validator.validatePlayer({ id: 'p1' }, { checkAlive: true }), 'E1100')
      expectInvalid(Validator.validatePlayer({ id: 'p1', isAlive: true }, { checkRole: true }), 'E1100')
    })

    it('should reject invalid or dead alive state', () => {
      expectInvalid(Validator.validatePlayer(createPlayer({ isAlive: 'yes' }), { checkAlive: true }), 'E1100')
      expectInvalid(Validator.validatePlayer(createPlayer({ isAlive: false }), { checkAlive: true }), 'E1103')
    })

    it('should reject role mismatch', () => {
      const result = Validator.validatePlayer(createPlayer({ role: 'VILLAGER' }), {
        checkRole: true,
        requiredRole: 'WOLF'
      })

      expectInvalid(result, 'E1402')
      expect(result.error.message).toContain('WOLF')
    })

    it('should convert unexpected validation exceptions to GameError', () => {
      const player = new Proxy({ id: 'p1' }, {
        getOwnPropertyDescriptor () {
          throw new Error('proxy failed')
        }
      })

      const result = Validator.validatePlayer(player)

      expectInvalid(result, 'E1100')
      expect(result.error.message).toContain('玩家验证失败')
    })
  })

  describe('validateGameState', () => {
    class AllowedState {}
    class OtherState {}

    it('should validate a game state with and without allowed state restrictions', () => {
      const state = new AllowedState()

      expect(Validator.validateGameState(makeGameWithState(state))).toEqual({ isValid: true })
      expect(Validator.validateGameState(makeGameWithState(state), [AllowedState])).toEqual({ isValid: true })
    })

    it('should reject invalid game and state machine inputs', () => {
      expectInvalid(Validator.validateGameState(null), 'E1201')
      expectInvalid(Validator.validateGameState({}), 'E1203')
      expectInvalid(Validator.validateGameState({ stateMachine: { getCurrentState: null } }), 'E1203')
      expectInvalid(Validator.validateGameState(makeGameWithState(null)), 'E1201')
    })

    it('should reject current state outside allowed states', () => {
      const result = Validator.validateGameState(makeGameWithState(new OtherState()), [AllowedState])

      expectInvalid(result, 'E1200')
    })

    it('should convert thrown state-machine errors to GameError', () => {
      const game = {
        stateMachine: {
          getCurrentState: jest.fn(() => {
            throw new Error('state failed')
          })
        }
      }

      const result = Validator.validateGameState(game)

      expectInvalid(result, 'E1203')
      expect(result.error.message).toContain('游戏状态验证失败')
    })
  })

  describe('validateTarget', () => {
    it('should validate an alive target without a custom validator', () => {
      expect(Validator.validateTarget(createPlayer())).toEqual({ isValid: true })
    })

    it('should validate an alive target with a custom validator and context', () => {
      const target = createPlayer()
      const context = { voterId: 'p2' }
      const validator = jest.fn(() => true)

      expect(Validator.validateTarget(target, validator, context)).toEqual({ isValid: true })
      expect(validator).toHaveBeenCalledWith(target, context)
    })

    it('should ignore non-function custom validator values', () => {
      expect(Validator.validateTarget(createPlayer(), 'not a function')).toEqual({ isValid: true })
    })

    it('should return basic player validation errors', () => {
      expectInvalid(Validator.validateTarget(createPlayer({ isAlive: false })), 'E1103')
    })

    it('should reject false custom validator results', () => {
      expectInvalid(Validator.validateTarget(createPlayer(), () => false), 'E1301')
    })

    it('should convert custom validator exceptions', () => {
      const result = Validator.validateTarget(createPlayer(), () => {
        throw new Error('custom failed')
      })

      expectInvalid(result, 'E1301')
      expect(result.error.message).toContain('目标验证器执行失败')
    })

    it('should convert unexpected target validation exceptions', () => {
      const original = Validator.validatePlayer
      Validator.validatePlayer = () => {
        throw new Error('basic failed')
      }

      try {
        const result = Validator.validateTarget(createPlayer())

        expectInvalid(result, 'E1301')
        expect(result.error.message).toContain('目标验证失败')
      } finally {
        Validator.validatePlayer = original
      }
    })
  })

  describe('validateAction', () => {
    class AllowedActionState {
      isValidAction () {
        return true
      }
    }

    it('should validate action with only player and action', () => {
      expect(Validator.validateAction(createPlayer(), 'vote')).toEqual({ isValid: true })
    })

    it('should validate action against game state and current state action rules', () => {
      const state = new AllowedActionState()
      const game = makeGameWithState(state)

      expect(Validator.validateAction(createPlayer(), 'vote', {
        game,
        allowedStates: [AllowedActionState],
        requiredRole: 'WOLF',
        checkAlive: true
      })).toEqual({ isValid: true })
    })

    it('should allow action when current state has no isValidAction method', () => {
      const state = {}
      const game = makeGameWithState(state)

      expect(Validator.validateAction(createPlayer(), 'vote', { game })).toEqual({ isValid: true })
    })

    it('should reject invalid player, role, action, and game state', () => {
      expectInvalid(Validator.validateAction(createPlayer({ isAlive: false }), 'vote'), 'E1103')
      expectInvalid(Validator.validateAction(createPlayer({ role: 'VILLAGER' }), 'vote', { requiredRole: 'WOLF' }), 'E1402')
      expectInvalid(Validator.validateAction(createPlayer(), ''), 'E1200')
      expectInvalid(Validator.validateAction(createPlayer(), 12), 'E1200')
      expectInvalid(Validator.validateAction(createPlayer(), 'vote', { game: makeGameWithState(null) }), 'E1201')
    })

    it('should reject actions disallowed by the current state', () => {
      const state = {
        isValidAction: jest.fn(() => false)
      }
      const game = makeGameWithState(state)

      const result = Validator.validateAction(createPlayer(), 'shoot', { game })

      expectInvalid(result, 'E1200')
      expect(state.isValidAction).toHaveBeenCalledWith(createPlayer(), 'shoot')
    })

    it('should convert unexpected action validation exceptions', () => {
      const original = Validator.validatePlayer
      Validator.validatePlayer = () => {
        throw new Error('player failed')
      }

      try {
        const result = Validator.validateAction(createPlayer(), 'vote')

        expectInvalid(result, 'E1200')
        expect(result.error.message).toContain('行动验证失败')
      } finally {
        Validator.validatePlayer = original
      }
    })
  })

  describe('validateGamePlayer', () => {
    it('should return player when game and player id are valid', () => {
      const player = createPlayer()
      const game = { players: new Map([['p1', player]]) }

      expect(Validator.validateGamePlayer(game, 'p1')).toEqual({
        isValid: true,
        player
      })
    })

    it('should reject invalid game player inputs', () => {
      expectInvalid(Validator.validateGamePlayer(null, 'p1'), 'E1201')
      expectInvalid(Validator.validateGamePlayer({}, 'p1'), 'E1203')
      expectInvalid(Validator.validateGamePlayer({ players: {} }, 'p1'), 'E1203')
      expectInvalid(Validator.validateGamePlayer({ players: new Map() }, ''), 'E1101')
      expectInvalid(Validator.validateGamePlayer({ players: new Map() }, 'p1'), 'E1101')
    })

    it('should convert thrown player lookup errors', () => {
      const game = {
        players: {
          get: jest.fn(() => {
            throw new Error('map failed')
          })
        }
      }

      const result = Validator.validateGamePlayer(game, 'p1')

      expectInvalid(result, 'E1203')
      expect(result.error.message).toContain('游戏玩家验证失败')
    })
  })

  describe('validateRole', () => {
    class WolfRole {}
    class VillagerRole {}

    it('should return role and player when role is valid', () => {
      const player = createPlayer()
      const role = new WolfRole()
      const game = {
        players: new Map([['p1', player]]),
        roles: new Map([['p1', role]])
      }

      expect(Validator.validateRole(game, 'p1', 'WolfRole')).toEqual({
        isValid: true,
        role,
        player
      })
    })

    it('should propagate invalid game player result', () => {
      expectInvalid(Validator.validateRole({ players: new Map() }, 'p1'), 'E1101')
    })

    it('should reject invalid roles collection, missing role, and role mismatch', () => {
      const player = createPlayer()

      expectInvalid(Validator.validateRole({ players: new Map([['p1', player]]) }, 'p1'), 'E1203')
      expectInvalid(Validator.validateRole({
        players: new Map([['p1', player]]),
        roles: new Map()
      }, 'p1'), 'E1101')
      expectInvalid(Validator.validateRole({
        players: new Map([['p1', player]]),
        roles: new Map([['p1', new VillagerRole()]])
      }, 'p1', 'WolfRole'), 'E1402')
    })

    it('should convert thrown role lookup errors', () => {
      const player = createPlayer()
      const game = {
        players: new Map([['p1', player]]),
        roles: {
          get: jest.fn(() => {
            throw new Error('role failed')
          })
        }
      }

      const result = Validator.validateRole(game, 'p1')

      expectInvalid(result, 'E1203')
      expect(result.error.message).toContain('角色验证失败')
    })
  })

  describe('validateGameNumber', () => {
    it('should validate numbers inside inclusive boundaries', () => {
      expect(Validator.validateGameNumber(1)).toEqual({ isValid: true })
      expect(Validator.validateGameNumber(12)).toEqual({ isValid: true })
      expect(Validator.validateGameNumber(5, 3, 6)).toEqual({ isValid: true })
    })

    it('should reject non-numbers and NaN', () => {
      expectInvalid(Validator.validateGameNumber('1'), 'E1101')
      expectInvalid(Validator.validateGameNumber(Number.NaN), 'E1101')
    })

    it('should reject numbers outside range', () => {
      expectInvalid(Validator.validateGameNumber(0), 'E1101')
      expectInvalid(Validator.validateGameNumber(13), 'E1101')
      expectInvalid(Validator.validateGameNumber(2, 3, 6), 'E1101')
    })
  })

  describe('validateVoteTarget', () => {
    it('should validate alive voter and target', () => {
      expect(Validator.validateVoteTarget(createPlayer({ id: 'p1' }), createPlayer({ id: 'p2' }))).toEqual({ isValid: true })
    })

    it('should reject invalid voter and invalid target', () => {
      expectInvalid(Validator.validateVoteTarget(createPlayer({ isAlive: false }), createPlayer({ id: 'p2' })), 'E1103')
      expectInvalid(Validator.validateVoteTarget(createPlayer({ id: 'p1' }), createPlayer({ id: 'p2', isAlive: false })), 'E1300')
    })

    it('should enforce self-vote option', () => {
      const voter = createPlayer({ id: 'p1' })
      const target = createPlayer({ id: 'p1' })

      expect(Validator.validateVoteTarget(voter, target, { allowSelfVote: true })).toEqual({ isValid: true })
      expectInvalid(Validator.validateVoteTarget(voter, target, { allowSelfVote: false }), 'E1300')
    })
  })

  describe('validateBatch', () => {
    it('should pass when all validators pass or are skipped', () => {
      const result = Validator.validateBatch([
        () => ({ isValid: true }),
        () => null,
        'not a function'
      ])

      expect(result).toEqual({
        isValid: true,
        errors: []
      })
    })

    it('should collect errors from failed validators', () => {
      const firstError = new GameError('玩家错误', 'E1100')
      const secondError = new GameError('行动错误', 'E1200')

      const result = Validator.validateBatch([
        () => ({ isValid: false, error: firstError }),
        () => ({ isValid: true }),
        () => ({ isValid: false, error: secondError })
      ])

      expect(result).toEqual({
        isValid: false,
        errors: [firstError, secondError]
      })
    })

    it('should convert thrown batch validation errors', () => {
      const result = Validator.validateBatch([
        () => {
          throw new Error('batch failed')
        }
      ])

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toBeInstanceOf(GameError)
      expect(result.errors[0].code).toBe('E1000')
      expect(result.errors[0].message).toContain('批量验证失败')
    })
  })
})
