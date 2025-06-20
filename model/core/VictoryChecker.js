/**
 * VictoryChecker.js - 胜利条件检查器
 *
 * 负责检查游戏是否结束以及哪个阵营获胜
 * 使用策略模式设计，每个检查器只负责检查一种胜利条件
 */

/**
 * 胜利结果类型
 * @typedef {Object} VictoryResult
 * @property {boolean} gameOver - 游戏是否结束
 * @property {string|null} winner - 获胜阵营 ("狼人"|"好人"|null)
 * @property {string|null} reason - 胜利原因
 */

/**
 * 基础检查器接口
 */
class VictoryConditionChecker {
  /**
   * 检查是否符合胜利条件
   * @param {Game} game - 游戏实例
   * @returns {VictoryResult} 胜利结果
   */
  check (game) {
    throw new Error('需要在子类中实现check方法')
  }
}

/**
 * 检查狼人全部死亡
 */
class WolfExtinctionChecker extends VictoryConditionChecker {
  check (game) {
    const aliveWolvesResult = game.getAlivePlayers({ campType: 'WOLF' })
    const aliveWolves = aliveWolvesResult ? aliveWolvesResult.length : 0

    if (aliveWolves === 0) {
      return {
        gameOver: true,
        winner: '好人',
        reason: '狼人全部出局'
      }
    }

    return { gameOver: false, winner: null, reason: null }
  }
}

/**
 * 检查好人全部死亡
 */
class GoodPeopleExtinctionChecker extends VictoryConditionChecker {
  check (game) {
    const aliveGodsResult = game.getAlivePlayers({ campType: 'GOD' })
    const aliveVillagersResult = game.getAlivePlayers({ campType: 'VILLAGER' })
    const aliveGods = aliveGodsResult ? aliveGodsResult.length : 0
    const aliveVillagers = aliveVillagersResult ? aliveVillagersResult.length : 0

    if (aliveGods === 0 && aliveVillagers === 0) {
      return {
        gameOver: true,
        winner: '狼人',
        reason: '好人全部出局'
      }
    }

    return { gameOver: false, winner: null, reason: null }
  }
}

/**
 * 检查屠边胜利条件 - 所有神职死亡
 */
class GodsExtinctionChecker extends VictoryConditionChecker {
  check (game) {
    // 只有在开启屠边规则时才检查
    const tubian = game.config?.game?.enableTubian
    if (!tubian) return { gameOver: false, winner: null, reason: null }

    const aliveGodsResult = game.getAlivePlayers({ campType: 'GOD' })
    const aliveGods = aliveGodsResult ? aliveGodsResult.length : 0

    if (aliveGods === 0) {
      return {
        gameOver: true,
        winner: '狼人',
        reason: '神职全部出局'
      }
    }

    return { gameOver: false, winner: null, reason: null }
  }
}

/**
 * 检查屠边胜利条件 - 所有平民死亡
 */
class VillagersExtinctionChecker extends VictoryConditionChecker {
  check (game) {
    // 只有在开启屠边规则时才检查
    const tubian = game.config?.game?.enableTubian
    if (!tubian) return { gameOver: false, winner: null, reason: null }

    const aliveVillagersResult = game.getAlivePlayers({ campType: 'VILLAGER' })
    const aliveVillagers = aliveVillagersResult ? aliveVillagersResult.length : 0

    if (aliveVillagers === 0) {
      return {
        gameOver: true,
        winner: '狼人',
        reason: '平民全部出局'
      }
    }

    return { gameOver: false, winner: null, reason: null }
  }
}

/**
 * 胜利检查器主类
 */
export class VictoryChecker {
  constructor () {
    // 注册所有检查器
    this.checkers = [
      new WolfExtinctionChecker(),
      new GoodPeopleExtinctionChecker(),
      new GodsExtinctionChecker(),
      new VillagersExtinctionChecker()
    ]
  }

  /**
   * 检查游戏是否结束
   * @param {Game} game - 游戏实例
   * @returns {VictoryResult} 胜利结果
   */
  checkVictory (game) {
    // 依次调用每个检查器
    for (const checker of this.checkers) {
      const result = checker.check(game)
      if (result.gameOver) return result
    }

    // 如果没有检查器返回游戏结束，则返回游戏继续
    return { gameOver: false, winner: null, reason: null }
  }
}
