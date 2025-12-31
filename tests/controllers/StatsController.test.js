import { jest } from '@jest/globals'

function makeEvent (overrides = {}) {
  return {
    user_id: 1,
    reply: jest.fn(),
    ...overrides
  }
}

async function loadStatsController ({
  getStatsImpl = null,
  getRankingImpl = null,
  writeJSONThrows = false
} = {}) {
  jest.resetModules()

  const store = Object.create(null)
  const writeJSON = jest.fn(() => {
    if (writeJSONThrows) throw new Error('write failed')
  })

  const PlayerStats = {
    getStats: jest.fn((id) => (getStatsImpl ? getStatsImpl(id, store) : store[id] || null)),
    getRanking: jest.fn((limit) => (getRankingImpl ? getRankingImpl(limit) : [])),
    updateStats: jest.fn(),
    stats: store,
    data: { writeJSON },
    dataFile: 'data/werewolf/player_stats.json'
  }

  jest.unstable_mockModule('../../utils/PlayerStats.js', () => ({
    default: PlayerStats
  }))

  const { StatsController } = await import('../../controllers/StatsController.js')
  return { StatsController, PlayerStats, store, writeJSON }
}

describe('StatsController', () => {
  test('showMyStats replies when no stats', async () => {
    const { StatsController } = await loadStatsController()
    const e = makeEvent({ user_id: 123 })

    const ok = StatsController.showMyStats(e)

    expect(ok).toBe(true)
    expect(e.reply).toHaveBeenCalledWith('你还没有任何狼人杀游戏记录。')
  })

  test('showMyStats formats stats and roles', async () => {
    const { StatsController, store } = await loadStatsController()
    store['123'] = {
      userId: '123',
      name: 'Alice',
      totalGames: 10,
      wins: 6,
      roles: {
        狼人: { played: 3, wins: 2 },
        村民: { played: 5, wins: 3 },
        预言家: { played: 2, wins: 1 }
      }
    }

    const e = makeEvent({ user_id: 123 })
    const ok = StatsController.showMyStats(e)

    expect(ok).toBe(true)
    expect(e.reply).toHaveBeenCalled()
    const msg = e.reply.mock.calls[0][0]
    expect(msg).toContain('【Alice的战绩】')
    expect(msg).toContain('总场次: 10')
    expect(msg).toContain('胜利场次: 6')
    expect(msg).toContain('常用角色:')
  })

  test('showRankings replies when ranking is empty', async () => {
    const { StatsController } = await loadStatsController()
    const e = makeEvent()

    const ok = StatsController.showRankings(e)

    expect(ok).toBe(true)
    expect(e.reply).toHaveBeenCalledWith('暂时还没有满足条件的玩家进入排行榜（至少需要5场游戏）。')
  })

  test('showRankings formats ranking list', async () => {
    const { StatsController } = await loadStatsController({
      getRankingImpl: () => ([
        { name: 'A', winRate: 0.8, wins: 8, totalGames: 10 },
        { name: 'B', winRate: 0.6, wins: 6, totalGames: 10 }
      ])
    })
    const e = makeEvent()

    const ok = StatsController.showRankings(e, 10)

    expect(ok).toBe(true)
    expect(e.reply).toHaveBeenCalled()
    const msg = e.reply.mock.calls[0][0]
    expect(msg).toContain('Top 2')
    expect(msg).toContain('1. A')
    expect(msg).toContain('2. B')
  })

  test('updateStats delegates when result.game exists', async () => {
    const { StatsController, PlayerStats } = await loadStatsController()
    const game = { id: 1 }

    const ok = StatsController.updateStats('123', { game, winner: '好人' })

    expect(ok).toBe(true)
    expect(PlayerStats.updateStats).toHaveBeenCalledWith(game, { game, winner: '好人' })
  })

  test('updateStats does minimal update and persists', async () => {
    const { StatsController, store, writeJSON } = await loadStatsController()

    const ok = StatsController.updateStats('123', { didWin: true, roleName: 'WOLF', name: 'Alice' })

    expect(ok).toBe(true)
    expect(store['123'].totalGames).toBe(1)
    expect(store['123'].wins).toBe(1)
    expect(store['123'].roles.WOLF.played).toBe(1)
    expect(store['123'].roles.WOLF.wins).toBe(1)
    expect(writeJSON).toHaveBeenCalled()
  })

  test('updateStats returns false on persistence error', async () => {
    const { StatsController } = await loadStatsController({ writeJSONThrows: true })
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const ok = StatsController.updateStats('123', { didWin: false })

    expect(ok).toBe(false)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

