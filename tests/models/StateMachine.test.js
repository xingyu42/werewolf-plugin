import { jest } from '@jest/globals'

import { isValidTransition, StateMachine } from '../../models/StateMachine.js'

describe('StateMachine / isValidTransition', () => {
  test('rejects transition when source has no transitions defined', () => {
    const result = isValidTransition('UnknownState', 'DayState', { turn: 1 })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('未定义从 UnknownState 的任何转换')
  })

  test('rejects transition when target is not allowed', () => {
    const result = isValidTransition('DayState', 'SheriffTransferState', { turn: 1 })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('不允许从 DayState 转换到 SheriffTransferState')
  })

  test('rejects conditional transition when condition not met', () => {
    const result = isValidTransition('DayState', 'SheriffElectState', { turn: 2 })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('条件不满足')
  })

  test('allows conditional transition when condition met', () => {
    const result = isValidTransition('DayState', 'SheriffElectState', { turn: 0 })
    expect(result.allowed).toBe(true)
  })

  test('covers additional transition conditions', () => {
    expect(isValidTransition('NightPhaseController', 'DayState', { turn: 1 }).allowed).toBe(true)

    expect(
      isValidTransition('LastWordsState', 'NightPhaseController', { turn: 1 }, { deadPlayer: { isSheriff: false } }).allowed
    ).toBe(true)
    expect(
      isValidTransition('LastWordsState', 'SheriffTransferState', { turn: 1 }, { deadPlayer: { isSheriff: true } }).allowed
    ).toBe(true)

    expect(isValidTransition('SheriffElectState', 'DayState', { turn: 1 }).allowed).toBe(true)
    expect(isValidTransition('SheriffTransferState', 'NightPhaseController', { turn: 1 }).allowed).toBe(true)
  })
})

describe('StateMachine.changeState', () => {
  class DayState {
    onEnter = jest.fn(async () => {})
    onExit = jest.fn(async () => {})
    setContext = jest.fn()
  }

  class VoteState {
    onEnter = jest.fn(async () => {})
    onExit = jest.fn(async () => {})
    setContext = jest.fn()
  }

  test('logs and returns when newState is undefined', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const sm = new StateMachine(new DayState())
    sm.setContext({ turn: 1 })

    await sm.changeState(undefined)

    expect(spy).toHaveBeenCalled()
    expect(sm.getCurrentState()).toBeInstanceOf(DayState)
    spy.mockRestore()
  })

  test('blocks re-entrancy when already changing', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const sm = new StateMachine(new DayState())
    sm._changingState = true

    await sm.changeState(new VoteState())

    expect(warn).toHaveBeenCalled()
    expect(sm.getCurrentState()).toBeInstanceOf(DayState)
    warn.mockRestore()
  })

  test('performs valid transition and records history', async () => {
    const sm = new StateMachine(new DayState())
    sm.setContext({ turn: 7 })

    const next = new VoteState()
    await sm.changeState(next)

    expect(sm.getCurrentState()).toBe(next)
    expect(sm.stateHistory).toHaveLength(1)
    expect(sm.stateHistory[0].stateType).toBe('DayState')
    expect(sm.stateHistory[0].turn).toBe(7)
    expect(next.setContext).toHaveBeenCalledWith(sm.game)
    expect(next.onEnter).toHaveBeenCalled()
  })

  test('rejects invalid transition without calling enter/exit', async () => {
    class SheriffElectState {
      onEnter = jest.fn(async () => {})
      onExit = jest.fn(async () => {})
      setContext = jest.fn()
    }

    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const sm = new StateMachine(new VoteState())
    sm.setContext({ turn: 1 })

    const next = new SheriffElectState()
    await sm.changeState(next)

    expect(sm.getCurrentState()).toBeInstanceOf(VoteState)
    expect(next.onEnter).not.toHaveBeenCalled()
    expect(sm.stateHistory).toHaveLength(0)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  test('handles errors during transition and resets changing flag', async () => {
    class VoteState2 {
      onEnter = jest.fn(async () => { throw new Error('enter failed') })
      onExit = jest.fn(async () => {})
    }

    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const sm = new StateMachine(new DayState())
    sm.setContext({ turn: 1 })

    await sm.changeState(new VoteState2())

    expect(sm._changingState).toBe(false)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  test('recordStateHistory trims by maxHistoryLength and context setter works', () => {
    const sm = new StateMachine()
    sm.maxHistoryLength = 1
    sm.setContext({ turn: 9 })

    sm.recordStateHistory({ constructor: { name: 'A' } })
    sm.recordStateHistory({ constructor: { name: 'B' } })
    expect(sm.stateHistory).toHaveLength(1)
    expect(sm.stateHistory[0].stateType).toBe('B')

    sm.setStateTransitionContext(null)
    expect(sm.stateTransitionContext).toEqual({})
  })
})
