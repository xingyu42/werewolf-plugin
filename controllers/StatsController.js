/**
 * @file StatsController.js
 * @description 统计控制器，处理玩家战绩查询和更新
 * @module controllers/StatsController
 *
 * @input PlayerStats
 * @output StatsController - 统计控制器类
 * @pos 控制器层 - 统计数据查询和处理
 *
 * @dependencies
 * - ../utils/PlayerStats.js - 玩家统计工具
 */
import PlayerStats from '../utils/PlayerStats.js'

export class StatsController {
  static getPlayerStats (userId) {
    return PlayerStats.getStats(String(userId))
  }

  static getRankings (limit = 10) {
    return PlayerStats.getRanking(limit)
  }

  static showMyStats (e) {
    const stats = this.getPlayerStats(e.user_id)

    if (!stats) {
      e.reply('你还没有任何狼人杀游戏记录。')
      return true
    }

    const winRate = stats.totalGames > 0 ? ((stats.wins / stats.totalGames) * 100).toFixed(2) : 0

    let replyMsg = `【${stats.name}的战绩】\n`
    replyMsg += `总场次: ${stats.totalGames}\n`
    replyMsg += `胜利场次: ${stats.wins}\n`
    replyMsg += `胜率: ${winRate}%\n\n`
    replyMsg += '常用角色:\n'

    const sortedRoles = Object.entries(stats.roles || {})
      .sort(([, a], [, b]) => (b?.played || 0) - (a?.played || 0))
      .slice(0, 3)

    if (sortedRoles.length > 0) {
      for (const [roleName, roleStats] of sortedRoles) {
        const played = roleStats?.played || 0
        const wins = roleStats?.wins || 0
        const roleWinRate = played > 0 ? ((wins / played) * 100).toFixed(2) : 0
        replyMsg += `- ${roleName}: 玩${played}次, 胜${wins}次, 胜率${roleWinRate}%\n`
      }
    } else {
      replyMsg += '无'
    }

    e.reply(replyMsg)
    return true
  }

  static showRankings (e, limit = 10) {
    const ranking = this.getRankings(limit)

    if (!ranking || ranking.length === 0) {
      e.reply('暂时还没有满足条件的玩家进入排行榜（至少需要5场游戏）。')
      return true
    }

    let replyMsg = `🏆 狼人杀大神榜 (Top ${Math.min(limit, ranking.length)})\n`
    replyMsg += '---------------------------\n'

    ranking.forEach((player, index) => {
      const winRate = ((player?.winRate || 0) * 100).toFixed(2)
      replyMsg += `${index + 1}. ${player.name} | 胜率: ${winRate}% (${player.wins}/${player.totalGames}场)\n`
    })

    e.reply(replyMsg)
    return true
  }

  /**
   * Update stats.
   * - If `result.game` is provided, delegates to `PlayerStats.updateStats(game, result)` (recommended).
   * - Otherwise performs a minimal per-user update based on `{ didWin, roleName, name }`.
   */
  static updateStats (userId, result = {}) {
    try {
      if (result?.game) {
        PlayerStats.updateStats(result.game, result)
        return true
      }

      const id = String(userId)
      const didWin = !!result.didWin
      const roleName = result.roleName || 'UNKNOWN'
      const name = result.name || id

      // Best-effort: mutate the singleton's in-memory stats and persist using its internal Data wrapper.
      const current = PlayerStats.getStats(id) || {
        userId: id,
        name,
        totalGames: 0,
        wins: 0,
        roles: {}
      }

      current.name = name
      current.totalGames += 1
      if (didWin) current.wins += 1

      if (!current.roles[roleName]) current.roles[roleName] = { played: 0, wins: 0 }
      current.roles[roleName].played += 1
      if (didWin) current.roles[roleName].wins += 1

      // Persist via the underlying instance fields (stable in this codebase).
      PlayerStats.stats[id] = current
      PlayerStats.data.writeJSON(PlayerStats.dataFile, PlayerStats.stats)

      return true
    } catch (error) {
      console.error('[StatsController] updateStats failed:', error)
      return false
    }
  }
}
