import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals'

const mockPlayerStats = {
  getStats: jest.fn(),
  getRanking: jest.fn(),
  updateStats: jest.fn(),
  stats: {},
  data: {
    writeJSON: jest.fn()
  },
  dataFile: 'mock-stats.json'
}

jest.unstable_mockModule('../../utils/PlayerStats.js', () => ({
  default: mockPlayerStats
}))

const { StatsController } = await import('../../controllers/StatsController.js')

const createEvent = (overrides = {}) => ({
  group_id: 1001,
  user_id: 123,
  reply: jest.fn(),
  bot: {
    fl: {
      has: jest.fn()
    },
    pickFriend: jest.fn()
  },
  isMaster: false,
  msg: '',
  member: {
    card: '玩家1',
    nickname: '昵称1'
  },
  sender: {
    nickname: '发送者1'
  },
  ...overrides
})

describe('StatsController', () => {
  let consoleErrorSpy

  beforeEach(() => {
    jest.clearAllMocks()
    mockPlayerStats.stats = {}
    mockPlayerStats.data = {
      writeJSON: jest.fn()
    }
    mockPlayerStats.dataFile = 'mock-stats.json'
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  test('getPlayerStats should stringify user id and delegate to PlayerStats', () => {
    const stats = {
      userId: '123',
      totalGames: 1
    }
    mockPlayerStats.getStats.mockReturnValueOnce(stats)

    expect(StatsController.getPlayerStats(123)).toBe(stats)
    expect(mockPlayerStats.getStats).toHaveBeenCalledWith('123')
  })

  test('getRankings should use default and custom limit', () => {
    mockPlayerStats.getRanking.mockReturnValue([])

    expect(StatsController.getRankings()).toEqual([])
    expect(mockPlayerStats.getRanking).toHaveBeenCalledWith(10)

    StatsController.getRankings(3)
    expect(mockPlayerStats.getRanking).toHaveBeenLastCalledWith(3)
  })

  test('showMyStats should reply no record message when stats missing', () => {
    const e = createEvent()
    mockPlayerStats.getStats.mockReturnValueOnce(null)

    expect(StatsController.showMyStats(e)).toBe(true)
    expect(mockPlayerStats.getStats).toHaveBeenCalledWith('123')
    expect(e.reply).toHaveBeenCalledWith('你还没有任何狼人杀游戏记录。')
  })

  test('showMyStats should format total games, win rate and top three roles', () => {
    const e = createEvent()
    mockPlayerStats.getStats.mockReturnValueOnce({
      userId: '123',
      name: '玩家A',
      totalGames: 10,
      wins: 6,
      roles: {
        狼人: {
          played: 2,
          wins: 1
        },
        预言家: {
          played: 5,
          wins: 4
        },
        女巫: {
          played: 3,
          wins: 1
        },
        村民: {
          played: 8,
          wins: 5
        }
      }
    })

    expect(StatsController.showMyStats(e)).toBe(true)

    const reply = e.reply.mock.calls[0][0]
    expect(reply).toContain('【玩家A的战绩】')
    expect(reply).toContain('总场次: 10')
    expect(reply).toContain('胜利场次: 6')
    expect(reply).toContain('胜率: 60.00%')
    expect(reply).toContain('- 村民: 玩8次, 胜5次, 胜率62.50%')
    expect(reply).toContain('- 预言家: 玩5次, 胜4次, 胜率80.00%')
    expect(reply).toContain('- 女巫: 玩3次, 胜1次, 胜率33.33%')
    expect(reply).not.toContain('- 狼人: 玩2次')
  })

  test('showMyStats should handle zero games and empty roles', () => {
    const e = createEvent()
    mockPlayerStats.getStats.mockReturnValueOnce({
      userId: '123',
      name: '玩家A',
      totalGames: 0,
      wins: 0,
      roles: {}
    })

    expect(StatsController.showMyStats(e)).toBe(true)

    const reply = e.reply.mock.calls[0][0]
    expect(reply).toContain('胜率: 0%')
    expect(reply).toContain('常用角色:\n无')
  })

  test('showRankings should reply empty ranking message', () => {
    const e = createEvent()
    mockPlayerStats.getRanking.mockReturnValueOnce([])

    expect(StatsController.showRankings(e)).toBe(true)
    expect(mockPlayerStats.getRanking).toHaveBeenCalledWith(10)
    expect(e.reply).toHaveBeenCalledWith('暂时还没有满足条件的玩家进入排行榜（至少需要5场游戏）。')
  })

  test('showRankings should format ranking list with requested limit', () => {
    const e = createEvent()
    mockPlayerStats.getRanking.mockReturnValueOnce([
      {
        name: '玩家A',
        wins: 8,
        totalGames: 10,
        winRate: 0.8
      },
      {
        name: '玩家B',
        wins: 6,
        totalGames: 10,
        winRate: 0.6
      }
    ])

    expect(StatsController.showRankings(e, 5)).toBe(true)

    const reply = e.reply.mock.calls[0][0]
    expect(reply).toContain('🏆 狼人杀大神榜 (Top 2)')
    expect(reply).toContain('1. 玩家A | 胜率: 80.00% (8/10场)')
    expect(reply).toContain('2. 玩家B | 胜率: 60.00% (6/10场)')
  })

  test('updateStats should delegate game mode result to PlayerStats', () => {
    const game = {
      id: 'game-1'
    }
    const result = {
      game,
      winners: ['u1']
    }

    expect(StatsController.updateStats(123, result)).toBe(true)
    expect(mockPlayerStats.updateStats).toHaveBeenCalledWith(game, result)
    expect(mockPlayerStats.data.writeJSON).not.toHaveBeenCalled()
  })

  test('updateStats should create and persist manual stats when player has no record', () => {
    mockPlayerStats.getStats.mockReturnValueOnce(null)

    expect(StatsController.updateStats(123, {
      didWin: true,
      roleName: '狼人',
      name: '玩家A'
    })).toBe(true)

    expect(mockPlayerStats.stats['123']).toEqual({
      userId: '123',
      name: '玩家A',
      totalGames: 1,
      wins: 1,
      roles: {
        狼人: {
          played: 1,
          wins: 1
        }
      }
    })
    expect(mockPlayerStats.data.writeJSON).toHaveBeenCalledWith('mock-stats.json', mockPlayerStats.stats)
  })

  test('updateStats should update existing manual stats with default values', () => {
    const current = {
      userId: '123',
      name: '旧名',
      totalGames: 2,
      wins: 1,
      roles: {
        UNKNOWN: {
          played: 1,
          wins: 0
        }
      }
    }
    mockPlayerStats.getStats.mockReturnValueOnce(current)

    expect(StatsController.updateStats(123, {})).toBe(true)

    expect(current).toEqual({
      userId: '123',
      name: '123',
      totalGames: 3,
      wins: 1,
      roles: {
        UNKNOWN: {
          played: 2,
          wins: 0
        }
      }
    })
    expect(mockPlayerStats.stats['123']).toBe(current)
  })

  test('updateStats should return false and log when persistence fails', () => {
    mockPlayerStats.getStats.mockReturnValueOnce(null)
    mockPlayerStats.data.writeJSON.mockImplementationOnce(() => {
      throw new Error('write failed')
    })

    expect(StatsController.updateStats(123, {
      didWin: false,
      roleName: '村民',
      name: '玩家A'
    })).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('[StatsController] updateStats failed:', expect.any(Error))
  })
})
