import { StatsController } from '../controllers/StatsController.js'

export class GameStats extends plugin {
  constructor () {
    super({
      name: '狼人杀战绩',
      dsc: '查询狼人杀游戏战绩和排行',
      event: 'message',
      priority: 5000,
      rule: [
        { reg: '^#我的战绩$', fnc: 'showMyStats' },
        { reg: '^#狼人杀战绩榜$', fnc: 'showRankings' }
      ]
    })
  }

  async showMyStats (e) { return StatsController.showMyStats(e) }
  async showRankings (e) { return StatsController.showRankings(e) }
}
