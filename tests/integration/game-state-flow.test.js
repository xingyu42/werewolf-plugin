import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { createMockEvent } from '../helpers/factories.js'

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
  GameError: class extends Error {
    constructor (msg, code) { super(msg); this.code = code }
  }
}))

const { Game } = await import('../../models/Game.js')
const { StateMachine } = await import('../../models/StateMachine.js')
const { GAME_PHASES } = await import('../../models/Constants.js')

class NightPhaseController {
  constructor () {
    this.onEnter = jest.fn()
    this.onExit = jest.fn()
    this.setContext = jest.fn()
    this.e = null
  }

  getName () { return 'NightPhaseController' }
}

class DayState {
  constructor (hooks = {}) {
    this.onEnter = hooks.onEnter || jest.fn()
    this.onExit = hooks.onExit || jest.fn()
    this.setContext = hooks.setContext || jest.fn()
    this.e = null
  }

  getName () { return 'DayState' }
}

class VoteState {
  constructor () {
    this.onEnter = jest.fn()
    this.onExit = jest.fn()
    this.setContext = jest.fn()
    this.e = null
  }

  getName () { return 'VoteState' }
}

function createRealGame (overrides = {}) {
  const e = overrides.e || createMockEvent()
  const sm = new StateMachine(overrides.initialState || null)
  return new Game({
    e,
    config: overrides.config || { game: {} },
    players: overrides.players || [],
    stateMachine: sm,
    victoryChecker: { checkVictory: jest.fn(() => ({ gameOver: false, winner: null, reason: null })) },
    groupId: overrides.groupId || 'int-test'
  })
}

describe('Integration: Game + StateMachine + State flow', () => {
  let consoleSpy

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  test('should enter first state through real StateMachine', async () => {
    const game = createRealGame()
    const state = new NightPhaseController()

    await game.changeState(state)

    expect(game.stateMachine.getCurrentState()).toBe(state)
    expect(game.currentState).toBe(state)
    expect(game.state).toBe(state)
    expect(state.onEnter).toHaveBeenCalledTimes(1)
    expect(state.setContext).toHaveBeenCalledWith(game)
    expect(game.stateHistory).toHaveLength(1)
    expect(game.stateHistory[0]).toMatchObject({
      from: 'none',
      to: 'NightPhaseController'
    })
  })

  test('should perform legal NightPhaseController -> DayState transition', async () => {
    const night = new NightPhaseController()
    const game = createRealGame()
    await game.changeState(night)

    const day = new DayState()
    await game.changeState(day)

    expect(night.onExit).toHaveBeenCalledTimes(1)
    expect(day.onEnter).toHaveBeenCalledTimes(1)
    expect(game.stateMachine.getCurrentState()).toBe(day)
    expect(game.currentState).toBe(day)
    expect(game.currentPhase).toBe(GAME_PHASES.DAY_DISCUSSION)

    expect(game.stateMachine.stateHistory).toHaveLength(1)
    expect(game.stateMachine.stateHistory[0].stateType).toBe('NightPhaseController')
  })

  test('should process queued transition from onEnter', async () => {
    const night = new NightPhaseController()
    const game = createRealGame()
    await game.changeState(night)

    const vote = new VoteState()
    const day = new DayState({
      onEnter: jest.fn(async () => {
        await game.changeState(vote)
      })
    })

    await game.changeState(day)

    expect(game.stateMachine.getCurrentState()).toBe(vote)
    expect(game.currentState).toBe(vote)
    expect(day.onEnter).toHaveBeenCalledTimes(1)
    expect(vote.onEnter).toHaveBeenCalledTimes(1)
  })

  test('should reject invalid transition — SM preserves state but Game records spurious history', async () => {
    const night = new NightPhaseController()
    const game = createRealGame()
    await game.changeState(night)

    const historyBefore = game.stateHistory.length
    const day = new DayState()
    await game.changeState(day)

    const night2 = new NightPhaseController()
    await game.changeState(night2)

    expect(game.stateMachine.getCurrentState()).toBe(day)
    expect(consoleSpy).toHaveBeenCalled()
    // Known behavior: Game.changeState pushes history BEFORE SM validation,
    // so stateHistory grows even on rejected transitions
    expect(game.stateHistory.length).toBeGreaterThan(historyBefore + 1)
  })
})
