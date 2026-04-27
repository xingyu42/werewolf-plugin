import { describe, expect, jest, test } from '@jest/globals'
import { VictoryChecker } from '../../models/VictoryChecker.js'

const createPlayers = (campType, count) => Array.from(
  { length: count },
  (_, index) => ({ id: `${campType}-${index}`, campType })
)

const createGame = ({
  wolves = 1,
  gods = 1,
  villagers = 1,
  enableTubian = false
} = {}) => ({
  config: {
    game: {
      enableTubian
    }
  },
  getAlivePlayers: jest.fn(({ campType } = {}) => {
    const counts = {
      WOLF: wolves,
      GOD: gods,
      VILLAGER: villagers
    }

    return createPlayers(campType, counts[campType] ?? 0)
  })
})

describe('VictoryChecker', () => {
  test('should return good people victory when all wolves are dead', () => {
    const game = createGame({ wolves: 0, gods: 1, villagers: 1 })
    const checker = new VictoryChecker()

    const result = checker.checkVictory(game)

    expect(result).toEqual({
      gameOver: true,
      winner: '好人',
      reason: '狼人全部出局'
    })
    expect(game.getAlivePlayers).toHaveBeenCalledTimes(1)
    expect(game.getAlivePlayers).toHaveBeenCalledWith({ campType: 'WOLF' })
  })

  test('should return wolves victory when gods and villagers are both dead', () => {
    const game = createGame({ wolves: 2, gods: 0, villagers: 0 })
    const checker = new VictoryChecker()

    const result = checker.checkVictory(game)

    expect(result).toEqual({
      gameOver: true,
      winner: '狼人',
      reason: '好人全部出局'
    })
    expect(game.getAlivePlayers).toHaveBeenCalledWith({ campType: 'WOLF' })
    expect(game.getAlivePlayers).toHaveBeenCalledWith({ campType: 'GOD' })
    expect(game.getAlivePlayers).toHaveBeenCalledWith({ campType: 'VILLAGER' })
  })

  test('should not apply gods extinction rule when tubian is disabled', () => {
    const game = createGame({
      wolves: 1,
      gods: 0,
      villagers: 2,
      enableTubian: false
    })
    const checker = new VictoryChecker()

    const result = checker.checkVictory(game)

    expect(result).toEqual({
      gameOver: false,
      winner: null,
      reason: null
    })
  })

  test('should return wolves victory when all gods are dead and tubian is enabled', () => {
    const game = createGame({
      wolves: 1,
      gods: 0,
      villagers: 2,
      enableTubian: true
    })
    const checker = new VictoryChecker()

    const result = checker.checkVictory(game)

    expect(result).toEqual({
      gameOver: true,
      winner: '狼人',
      reason: '神职全部出局'
    })
  })

  test('should return wolves victory when all villagers are dead and tubian is enabled', () => {
    const game = createGame({
      wolves: 1,
      gods: 2,
      villagers: 0,
      enableTubian: true
    })
    const checker = new VictoryChecker()

    const result = checker.checkVictory(game)

    expect(result).toEqual({
      gameOver: true,
      winner: '狼人',
      reason: '平民全部出局'
    })
  })

  test('should return non-game-over result when no victory condition is met', () => {
    const game = createGame({
      wolves: 1,
      gods: 1,
      villagers: 1,
      enableTubian: true
    })
    const checker = new VictoryChecker()

    const result = checker.checkVictory(game)

    expect(result).toEqual({
      gameOver: false,
      winner: null,
      reason: null
    })
  })

  test('should treat undefined alive player query result as zero players', () => {
    const game = {
      config: {
        game: {
          enableTubian: false
        }
      },
      getAlivePlayers: jest.fn(() => undefined)
    }
    const checker = new VictoryChecker()

    const result = checker.checkVictory(game)

    expect(result).toEqual({
      gameOver: true,
      winner: '好人',
      reason: '狼人全部出局'
    })
  })
})
