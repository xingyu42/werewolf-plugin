import PlayerStats from '../model/stats/PlayerStats.js';

export class GameStats extends plugin {
  constructor() {
    super({
      name: '狼人杀战绩',
      dsc: '查询狼人杀游戏战绩和排行',
      event: 'message',
      priority: 5000,
      rule: [
        { reg: '^#我的战绩$', fnc: 'showMyStats' },
        { reg: '^#狼人杀排行$', fnc: 'showRanking' },
      ],
    });

    this.playerStats = PlayerStats;
  }

  async showMyStats(e) {
    const stats = this.playerStats.getStats(e.user_id);

    if (!stats) {
      e.reply('你还没有任何狼人杀游戏记录。');
      return true;
    }

    const winRate = stats.totalGames > 0 ? ((stats.wins / stats.totalGames) * 100).toFixed(2) : 0;
    
    let replyMsg = `【${stats.name}的战绩】\n`;
    replyMsg += `总场次: ${stats.totalGames}\n`;
    replyMsg += `胜利场次: ${stats.wins}\n`;
    replyMsg += `胜率: ${winRate}%\n\n`;
    replyMsg += '常用角色:\n';

    const sortedRoles = Object.entries(stats.roles)
      .sort(([, a], [, b]) => b.played - a.played)
      .slice(0, 3);

    if (sortedRoles.length > 0) {
      for (const [roleName, roleStats] of sortedRoles) {
        const roleWinRate = roleStats.played > 0 ? ((roleStats.wins / roleStats.played) * 100).toFixed(2) : 0;
        replyMsg += `- ${roleName}: 玩${roleStats.played}次, 胜${roleStats.wins}次, 胜率${roleWinRate}%\n`;
      }
    } else {
      replyMsg += '无';
    }

    e.reply(replyMsg);
    return true;
  }

  async showRanking(e) {
    const ranking = this.playerStats.getRanking(10);

    if (ranking.length === 0) {
      e.reply('暂时还没有满足条件的玩家进入排行榜（至少需要5场游戏）。');
      return true;
    }

    let replyMsg = '🏆 狼人杀大神榜 (Top 10)\n';
    replyMsg += '---------------------------\n';

    ranking.forEach((player, index) => {
      const winRate = (player.winRate * 100).toFixed(2);
      replyMsg += `${index + 1}. ${player.name} | 胜率: ${winRate}% (${player.wins}/${player.totalGames}场)\n`;
    });

    e.reply(replyMsg);
    return true;
  }
} 