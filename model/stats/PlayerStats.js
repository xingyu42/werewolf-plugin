/**
 * 玩家统计数据管理器
 */
class PlayerStats {
  constructor(data, redis) {
    this.dataFile = 'data/werewolf/player_stats.json';
    this.data = data;
    this.redis = redis; // Though not used in constructor, good practice to have it if methods need it.
    this.stats = this.data.readJSON(this.dataFile);

    // 如果文件不存在或为空，则初始化
    if (Object.keys(this.stats).length === 0) {
      this.data.writeJSON(this.dataFile, {});
    }
  }

  /**
   * 更新游戏结束后所有玩家的统计数据
   * @param {import('../core/Game.js').Game} game - 结束的游戏实例
   * @param {object} result - 游戏结果, 包含 a.o. `winner`
   */
  updateStats(game, result) {
    if (!game || !result || !result.winner) {
      console.error('[PlayerStats] 无效的游戏结果，无法更新统计。');
      return;
    }

    const winningCamp = result.winner;

    for (const [playerId, player] of game.players) {
      const role = game.roles.get(playerId);
      if (!role) continue;

      const playerCamp = role.getCamp();
      const playerRoleName = role.constructor.name;
      const didWin = playerCamp === winningCamp;

      // 初始化玩家数据
      if (!this.stats[playerId]) {
        this.stats[playerId] = {
          userId: playerId,
          name: player.name,
          totalGames: 0,
          wins: 0,
          roles: {},
        };
      }

      const playerData = this.stats[playerId];
      playerData.name = player.name; // 确保名字是最新的
      playerData.totalGames += 1;
      if (didWin) {
        playerData.wins += 1;
      }

      // 初始化角色数据
      if (!playerData.roles[playerRoleName]) {
        playerData.roles[playerRoleName] = { played: 0, wins: 0 };
      }

      const roleData = playerData.roles[playerRoleName];
      roleData.played += 1;
      if (didWin) {
        roleData.wins += 1;
      }
    }

    this.data.writeJSON(this.dataFile, this.stats);
    console.log('[PlayerStats] 玩家统计数据已更新。');
  }

  /**
   * 获取单个玩家的统计数据
   * @param {string} userId - 玩家的QQ号
   * @returns {object | null}
   */
  getStats(userId) {
    return this.stats[userId] || null;
  }

  /**
   * 获取排行榜
   * @param {number} topN - 需要返回的排名前N位，默认为10
   * @returns {Array<object>}
   */
  getRanking(topN = 10) {
    const MIN_GAMES = 5; // 至少需要5场游戏才能上榜

    const players = Object.values(this.stats);

    const rankedPlayers = players
      .filter(p => p.totalGames >= MIN_GAMES)
      .map(p => ({
        ...p,
        winRate: p.totalGames > 0 ? (p.wins / p.totalGames) : 0,
      }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, topN);

    return rankedPlayers;
  }
}

// 导出 PlayerStats 的单个实例
export default PlayerStats; 