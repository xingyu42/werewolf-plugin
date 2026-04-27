import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { createDeferred } from '../helpers/deferred.js'
import { StateMachine } from '../../models/StateMachine.js'

class NightPhaseController {
  constructor (hooks = {}) {
    this.onEnter = hooks.onEnter || jest.fn()
    this.onExit = hooks.onExit || jest.fn()
    this.setContext = hooks.setContext || jest.fn()
  }

  getName () { return 'NightPhaseController' }
}

class DayState {
  constructor (hooks = {}) {
    this.onEnter = hooks.onEnter || jest.fn()
    this.onExit = hooks.onExit || jest.fn()
    this.setContext = hooks.setContext || jest.fn()
  }

  getName () { return 'DayState' }
}

class VoteState {
  constructor (hooks = {}) {
    this.onEnter = hooks.onEnter || jest.fn()
    this.onExit = hooks.onExit || jest.fn()
    this.setContext = hooks.setContext || jest.fn()
  }

  getName () { return 'VoteState' }
}

describe('StateMachine concurrency (deferred promise)', () => {
  let consoleSpy

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('real concurrent transitions', () => {
    test('should queue pending state when transition is blocked by onExit', async () => {
      const gate = createDeferred()
      const night = new NightPhaseController({
        onExit: jest.fn(() => gate.promise)
      })
      const day = new DayState()
      const vote = new VoteState()

      const machine = new StateMachine(night)
      machine.setContext({ turn: 1 })

      const firstTransition = machine.changeState(day)

      expect(night.onExit).toHaveBeenCalledTimes(1)

      const secondResult = await machine.changeState(vote)
      expect(secondResult).toBe(true)

      gate.resolve()
      const firstResult = await firstTransition

      expect(firstResult).toBe(true)
      expect(machine.getCurrentState()).toBe(vote)
      expect(machine._pendingState).toBeNull()

      expect(day.onEnter).toHaveBeenCalledTimes(1)
      expect(day.onExit).toHaveBeenCalledTimes(1)
      expect(vote.onEnter).toHaveBeenCalledTimes(1)
    })

    test('should overwrite pending with last request (single-slot behavior)', async () => {
      const gate = createDeferred()
      const night = new NightPhaseController({
        onExit: jest.fn(() => gate.promise)
      })
      const stateA = new DayState()
      const stateB = new VoteState()

      const machine = new StateMachine(night)
      machine.setContext({ turn: 1 })

      const firstTransition = machine.changeState(stateA)

      await machine.changeState(stateA)
      await machine.changeState(stateB)

      gate.resolve()
      await firstTransition

      expect(machine.getCurrentState()).toBe(stateB)
    })
  })

  describe('lifecycle failure resilience', () => {
    test('should release lock when onEnter throws, state still assigned', async () => {
      const night = new NightPhaseController()
      const day = new DayState({
        onEnter: jest.fn(() => { throw new Error('onEnter boom') })
      })

      const machine = new StateMachine(night)
      machine.setContext({ turn: 1 })

      const result = await machine.changeState(day)

      expect(result).toBe(true)
      expect(machine.getCurrentState()).toBe(day)
      expect(machine._changingState).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        'StateMachine: Error during state transition:',
        expect.any(Error)
      )
    })

    test('should stay on old state when onExit throws', async () => {
      const night = new NightPhaseController({
        onExit: jest.fn(() => { throw new Error('onExit boom') })
      })
      const day = new DayState()

      const machine = new StateMachine(night)
      machine.setContext({ turn: 1 })

      const result = await machine.changeState(day)

      expect(result).toBe(true)
      expect(machine.getCurrentState()).toBe(night)
      expect(machine._changingState).toBe(false)
      expect(day.onEnter).not.toHaveBeenCalled()
    })
  })
})
