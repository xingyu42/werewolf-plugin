import { jest } from '@jest/globals'

import { VictoryChecker } from '../../models/VictoryChecker.js'

function makeGame (aliveByCamp, enableTubian = false) {
  return {
    config: { game: { enableTubian } },
    getAlivePlayers: jest.fn(({ campType }) => aliveByCamp[campType] || [])
  }
}

describe('VictoryChecker', () => {
  test('good wins when all wolves are dead', () => {
    const checker = new VictoryChecker()
    const game = makeGame({ WOLF: [], GOD: [{}], VILLAGER: [{}] })

    const result = checker.checkVictory(game)

    expect(result.gameOver).toBe(true)
    expect(result.winner).toBe('好人')
    expect(result.reason).toContain('狼人全部出局')
  })

  test('wolves win when all good are dead', () => {
    const checker = new VictoryChecker()
    const game = makeGame({ WOLF: [{}], GOD: [], VILLAGER: [] })

    const result = checker.checkVictory(game)

    expect(result.gameOver).toBe(true)
    expect(result.winner).toBe('狼人')
    expect(result.reason).toContain('好人全部出局')
  })

  test('tubian rule: wolves win when all gods are dead', () => {
    const checker = new VictoryChecker()
    const game = makeGame({ WOLF: [{}], GOD: [], VILLAGER: [{}] }, true)

    const result = checker.checkVictory(game)

    expect(result.gameOver).toBe(true)
    expect(result.winner).toBe('狼人')
    expect(result.reason).toContain('神职全部出局')
  })

  test('tubian rule: wolves win when all villagers are dead', () => {
    const checker = new VictoryChecker()
    const game = makeGame({ WOLF: [{}], GOD: [{}], VILLAGER: [] }, true)

    const result = checker.checkVictory(game)

    expect(result.gameOver).toBe(true)
    expect(result.winner).toBe('狼人')
    expect(result.reason).toContain('平民全部出局')
  })

  test('continues game when no victory condition met', () => {
    const checker = new VictoryChecker()
    const game = makeGame({ WOLF: [{}], GOD: [{}], VILLAGER: [{}] }, false)

    const result = checker.checkVictory(game)

    expect(result.gameOver).toBe(false)
    expect(result.winner).toBe(null)
  })

  test('treats null return from getAlivePlayers as empty list', () => {
    const checker = new VictoryChecker()
    const game = {
      config: { game: { enableTubian: false } },
      getAlivePlayers: jest.fn(() => null)
    }

    const result = checker.checkVictory(game)

    expect(result.gameOver).toBe(true)
    expect(result.winner).toBe('好人')
  })
})
