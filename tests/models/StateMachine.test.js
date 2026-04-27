import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
  GameStateType,
  StateMachine,
  StateTransitions,
  isValidTransition
} from '../../models/StateMachine.js'

class MockState {
  constructor ({ onEnter, onExit, setContext } = {}) {
    this.onEnter = onEnter || jest.fn()
    this.onExit = onExit || jest.fn()
    this.setContext = setContext || jest.fn()
  }

  getName () {
    return this.constructor.name
  }
}

class NightPhaseController extends MockState {}
class InformationPhaseState extends MockState {}
class EliminationPhaseState extends MockState {}
class InterventionPhaseState extends MockState {}
class DayState extends MockState {}
class VoteState extends MockState {}
class LastWordsState extends MockState {}
class SheriffElectState extends MockState {}
class SheriffTransferState extends MockState {}
class UnknownState extends MockState {}

describe('StateMachine', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('GameStateType and StateTransitions', () => {
    test('should expose all state type names used by the state machine', () => {
      expect(GameStateType).toEqual({
        NIGHT: 'NightPhaseController',
        INFORMATION_PHASE: 'InformationPhaseState',
        ELIMINATION_PHASE: 'EliminationPhaseState',
        INTERVENTION_PHASE: 'InterventionPhaseState',
        DAY: 'DayState',
        VOTE: 'VoteState',
        LAST_WORDS: 'LastWordsState',
        SHERIFF_ELECT: 'SheriffElectState',
        SHERIFF_TRANSFER: 'SheriffTransferState'
      })
    })

    test('should exercise all condition functions in StateTransitions', () => {
      const allTransitions = [
        [GameStateType.NIGHT, GameStateType.INFORMATION_PHASE, { turn: 0 }],
        [GameStateType.NIGHT, GameStateType.ELIMINATION_PHASE, { turn: 0 }],
        [GameStateType.NIGHT, GameStateType.INTERVENTION_PHASE, { turn: 0 }],
        [GameStateType.NIGHT, GameStateType.DAY, { turn: 0 }],
        [GameStateType.INFORMATION_PHASE, GameStateType.ELIMINATION_PHASE, { turn: 0 }],
        [GameStateType.INFORMATION_PHASE, GameStateType.DAY, { turn: 0 }],
        [GameStateType.ELIMINATION_PHASE, GameStateType.INTERVENTION_PHASE, { turn: 0 }],
        [GameStateType.ELIMINATION_PHASE, GameStateType.DAY, { turn: 0 }],
        [GameStateType.INTERVENTION_PHASE, GameStateType.DAY, { turn: 0 }],
        [GameStateType.DAY, GameStateType.VOTE, { turn: 1 }],
        [GameStateType.DAY, GameStateType.LAST_WORDS, { turn: 0 }],
        [GameStateType.DAY, GameStateType.SHERIFF_ELECT, { turn: 0 }],
        [GameStateType.DAY, GameStateType.SHERIFF_TRANSFER, { turn: 1 }],
        [GameStateType.VOTE, GameStateType.LAST_WORDS, { turn: 1 }],
        [GameStateType.VOTE, GameStateType.NIGHT, { turn: 1 }],
        [GameStateType.LAST_WORDS, GameStateType.NIGHT, { turn: 1 }, { deadPlayer: { isSheriff: false } }],
        [GameStateType.LAST_WORDS, GameStateType.DAY, { turn: 0 }],
        [GameStateType.LAST_WORDS, GameStateType.SHERIFF_TRANSFER, { turn: 1 }, { deadPlayer: { isSheriff: true } }],
        [GameStateType.SHERIFF_ELECT, GameStateType.DAY, { turn: 1 }],
        [GameStateType.SHERIFF_TRANSFER, GameStateType.NIGHT, { turn: 1 }],
        [GameStateType.SHERIFF_TRANSFER, GameStateType.DAY, { turn: 1 }]
      ]

      for (const [from, to, game, context] of allTransitions) {
        const result = isValidTransition(from, to, game, context || {})
        expect(result.allowed).toBe(true)
      }
    })

    test('should define representative legal transition targets', () => {
      expect(StateTransitions[GameStateType.NIGHT]).toHaveProperty(GameStateType.DAY)
      expect(StateTransitions[GameStateType.NIGHT]).toHaveProperty(GameStateType.INFORMATION_PHASE)
      expect(StateTransitions[GameStateType.DAY]).toHaveProperty(GameStateType.VOTE)
      expect(StateTransitions[GameStateType.VOTE]).toHaveProperty(GameStateType.LAST_WORDS)
      expect(StateTransitions[GameStateType.LAST_WORDS]).toHaveProperty(GameStateType.SHERIFF_TRANSFER)
    })
  })

  describe('isValidTransition', () => {
    test('should allow configured transition and return transition description', () => {
      const result = isValidTransition(
        GameStateType.NIGHT,
        GameStateType.DAY,
        { turn: 1 }
      )

      expect(result).toEqual({
        allowed: true,
        reason: '夜晚结束，进入白天'
      })
    })

    test('should reject transition when source state has no transition configuration', () => {
      const result = isValidTransition('UnknownState', GameStateType.DAY, { turn: 1 })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('未定义从 UnknownState')
    })

    test('should reject transition when target state is not configured for source state', () => {
      const result = isValidTransition(GameStateType.DAY, GameStateType.NIGHT, { turn: 1 })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('不允许从 DayState 转换到 NightPhaseController')
    })

    test('should reject transition when condition is not met', () => {
      const result = isValidTransition(
        GameStateType.DAY,
        GameStateType.SHERIFF_ELECT,
        { turn: 1 }
      )

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('条件不满足')
    })

    test('should allow first-turn conditional transitions', () => {
      const result = isValidTransition(
        GameStateType.DAY,
        GameStateType.SHERIFF_ELECT,
        { turn: 0 }
      )

      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('首日特殊流程，进入警长竞选')
    })

    test('should use dead player context for sheriff transfer conditions', () => {
      const sheriffTransfer = isValidTransition(
        GameStateType.LAST_WORDS,
        GameStateType.SHERIFF_TRANSFER,
        { turn: 2 },
        { deadPlayer: { isSheriff: true } }
      )

      const nightWithoutSheriff = isValidTransition(
        GameStateType.LAST_WORDS,
        GameStateType.NIGHT,
        { turn: 2 },
        { deadPlayer: { isSheriff: false } }
      )

      const nightWithSheriff = isValidTransition(
        GameStateType.LAST_WORDS,
        GameStateType.NIGHT,
        { turn: 2 },
        { deadPlayer: { isSheriff: true } }
      )

      expect(sheriffTransfer.allowed).toBe(true)
      expect(nightWithoutSheriff.allowed).toBe(true)
      expect(nightWithSheriff.allowed).toBe(false)
    })
  })

  describe('StateMachine class', () => {
    test('should initialize with default state machine fields', () => {
      const initialState = new NightPhaseController()
      const machine = new StateMachine(initialState)

      expect(machine.currentState).toBe(initialState)
      expect(machine._changingState).toBe(false)
      expect(machine._pendingState).toBeNull()
      expect(machine.stateHistory).toEqual([])
      expect(machine.maxHistoryLength).toBe(50)
      expect(machine.game).toBeNull()
    })

    test('should set game context reference', () => {
      const machine = new StateMachine(null)
      const game = { turn: 3 }

      machine.setContext(game)

      expect(machine.game).toBe(game)
    })

    test('should reject null new state', async () => {
      const machine = new StateMachine(new NightPhaseController())

      await expect(machine.changeState(null)).resolves.toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith('StateMachine: newState is undefined')
    })

    test('should change state when transition is valid', async () => {
      const oldState = new NightPhaseController()
      const newState = new DayState()
      const game = { turn: 1 }
      const machine = new StateMachine(oldState)
      machine.setContext(game)

      const result = await machine.changeState(newState)

      expect(result).toBe(true)
      expect(oldState.onExit).toHaveBeenCalledTimes(1)
      expect(newState.setContext).toHaveBeenCalledWith(game)
      expect(newState.onEnter).toHaveBeenCalledTimes(1)
      expect(machine.currentState).toBe(newState)
      expect(machine.stateHistory).toHaveLength(1)
      expect(machine.stateHistory[0]).toMatchObject({
        stateType: 'NightPhaseController',
        turn: 1
      })
      expect(machine.stateHistory[0].timestamp).toBeInstanceOf(Date)
    })

    test('should reject invalid transition without invoking lifecycle hooks', async () => {
      const oldState = new DayState()
      const newState = new NightPhaseController()
      const machine = new StateMachine(oldState)
      machine.setContext({ turn: 1 })

      const result = await machine.changeState(newState)

      expect(result).toBe(false)
      expect(oldState.onExit).not.toHaveBeenCalled()
      expect(newState.onEnter).not.toHaveBeenCalled()
      expect(machine.currentState).toBe(oldState)
    })

    test('should enter first state without transition validation when current state is empty', async () => {
      const newState = new UnknownState()
      const machine = new StateMachine(null)
      const game = { turn: 0 }
      machine.setContext(game)

      const result = await machine.changeState(newState)

      expect(result).toBe(true)
      expect(newState.setContext).toHaveBeenCalledWith(game)
      expect(newState.onEnter).toHaveBeenCalledTimes(1)
      expect(machine.currentState).toBe(newState)
      expect(machine.stateHistory).toEqual([])
    })

    test('should queue state while a transition is already in progress', async () => {
      const machine = new StateMachine(new NightPhaseController())
      const pendingState = new DayState()
      machine._changingState = true

      const result = await machine.changeState(pendingState)

      expect(result).toBe(true)
      expect(machine._pendingState).toBe(pendingState)
    })

    test('should process pending state requested during onEnter', async () => {
      let machine
      const initialState = new DayState()
      const pendingState = new LastWordsState()
      const voteState = new VoteState({
        onEnter: jest.fn(async () => {
          await machine.changeState(pendingState)
        })
      })
      machine = new StateMachine(initialState)
      machine.setContext({ turn: 1 })

      const result = await machine.changeState(voteState)

      expect(result).toBe(true)
      expect(machine.currentState).toBe(pendingState)
      expect(voteState.onEnter).toHaveBeenCalledTimes(1)
      expect(voteState.onExit).toHaveBeenCalledTimes(1)
      expect(pendingState.onEnter).toHaveBeenCalledTimes(1)
      expect(machine._pendingState).toBeNull()
    })

    test('should cap state history at maxHistoryLength', () => {
      const machine = new StateMachine(null)
      machine.setContext({ turn: 7 })

      for (let index = 0; index < 51; index++) {
        machine.recordStateHistory(new DayState())
      }

      expect(machine.stateHistory).toHaveLength(50)
      expect(machine.stateHistory.every(entry => entry.stateType === 'DayState')).toBe(true)
      expect(machine.stateHistory.every(entry => entry.turn === 7)).toBe(true)
    })

    test('should set transition context and expose current state', () => {
      const state = new SheriffTransferState()
      const machine = new StateMachine(state)
      const context = { deadPlayer: { isSheriff: true } }

      machine.setStateTransitionContext(context)

      expect(machine.stateTransitionContext).toBe(context)
      expect(machine.getCurrentState()).toBe(state)

      machine.setStateTransitionContext(null)

      expect(machine.stateTransitionContext).toEqual({})
    })
  })
})
