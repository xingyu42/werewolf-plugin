import { afterEach, describe, expect, jest, test } from '@jest/globals'
import { WolfRole } from '../../models/roles/WolfRole.js'
import { flushPromises } from '../helpers/deferred.js'

jest.unstable_mockModule('../../models/roles/RoleFactory.js', () => ({
  RoleFactory: { getRoleCamp: jest.fn(), createRole: jest.fn() }
}))
jest.unstable_mockModule('../../models/states/NightPhaseController.js', () => ({
  NightPhaseController: class { constructor () { this.e = null } getName () { return 'NightPhaseController' } }
}))
jest.unstable_mockModule('../../utils/configurators/RoleConfigurator.js', () => ({
  RoleConfigurator: { generate: jest.fn() }
}))
jest.unstable_mockModule('../../utils/GameError.js', () => ({
  GameError: class extends Error { constructor (msg, code) { super(msg); this.code = code } }
}))

const { Game } = await import('../../models/Game.js')

describe('WolfRole static cleanup', () => {
  afterEach(() => {
    WolfRole.cleanup()
  })

  describe('direct cleanup', () => {
    test('should clear wolfVotes and wolfKillTarget', () => {
      WolfRole.wolfVotes.set('w1', { wolfId: 'w1', targetId: 'p2', timestamp: 1 })
      WolfRole.wolfVotes.set('w2', { wolfId: 'w2', targetId: 'p2', timestamp: 2 })
      WolfRole.wolfKillTarget = 'p2'

      WolfRole.cleanup()

      expect(WolfRole.wolfVotes.size).toBe(0)
      expect(WolfRole.wolfKillTarget).toBeNull()
    })

    test('should reset getStats to initial values', () => {
      WolfRole.wolfVotes.set('w1', { wolfId: 'w1', targetId: 'p3', timestamp: 1 })
      WolfRole.wolfKillTarget = 'p3'

      expect(WolfRole.getStats()).toEqual({
        voteCount: 1,
        hasKillTarget: true,
        killTarget: 'p3'
      })

      WolfRole.cleanup()

      expect(WolfRole.getStats()).toEqual({
        voteCount: 0,
        hasKillTarget: false,
        killTarget: null
      })
    })

    test('should be idempotent', () => {
      WolfRole.wolfVotes.set('w1', { wolfId: 'w1', targetId: 'p1', timestamp: 1 })
      WolfRole.wolfKillTarget = 'p1'

      WolfRole.cleanup()
      WolfRole.cleanup()

      expect(WolfRole.wolfVotes.size).toBe(0)
      expect(WolfRole.wolfKillTarget).toBeNull()
    })
  })

  describe('cross-game leak verification', () => {
    test('should prove static state persists without cleanup (leak scenario)', () => {
      WolfRole.wolfVotes.set('w1', { wolfId: 'w1', targetId: 'p2', timestamp: 1 })
      WolfRole.wolfKillTarget = 'p2'

      expect(WolfRole.wolfVotes.size).toBe(1)
      expect(WolfRole.wolfKillTarget).toBe('p2')
    })

    test('should verify cleanup clears cross-game leak', () => {
      WolfRole.wolfVotes.set('w1', { wolfId: 'w1', targetId: 'p2', timestamp: 1 })
      WolfRole.wolfKillTarget = 'p2'

      WolfRole.cleanup()

      WolfRole.wolfVotes.set('w2', { wolfId: 'w2', targetId: 'p3', timestamp: 3 })
      expect(WolfRole.wolfVotes.size).toBe(1)
      expect(WolfRole.wolfVotes.has('w1')).toBe(false)
    })
  })

  describe('Game.cleanup integration', () => {
    test('should clean WolfRole statics through real Game.cleanup path', async () => {
      WolfRole.wolfVotes.set('w1', { wolfId: 'w1', targetId: 'p5', timestamp: 99 })
      WolfRole.wolfKillTarget = 'p5'

      const e = { reply: jest.fn(), bot: { pickFriend: jest.fn(() => ({ sendMsg: jest.fn() })) } }
      const sm = {
        currentState: null,
        _pendingState: null,
        setContext: jest.fn(),
        getCurrentState: jest.fn(() => null),
        changeState: jest.fn(async () => true),
        setStateTransitionContext: jest.fn()
      }
      const game = new Game({
        e,
        config: {},
        players: [],
        stateMachine: sm,
        victoryChecker: { checkVictory: jest.fn(() => ({ gameOver: false })) },
        groupId: 'g1'
      })

      await game.cleanup()
      await flushPromises()

      expect(WolfRole.wolfVotes.size).toBe(0)
      expect(WolfRole.wolfKillTarget).toBeNull()
    })
  })
})
