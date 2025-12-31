/**
 * @file GameStart.js
 * @description 游戏启动应用，处理创建/加入/开始/结束游戏命令
 * @module apps/GameStart
 *
 * @input GameController
 * @output GameStart - 继承 plugin 的应用类
 * @pos 路由层 - 游戏启动和大厅管理
 *
 * @dependencies
 * - ../controllers/GameController.js - 游戏控制器
 */
import { GameController } from '../controllers/GameController.js'

export class GameStart extends plugin {
  constructor () {
    super({
      name: '狼人杀',
      dsc: '狼人杀游戏',
      event: 'message',
      priority: 5000,
      rule: [
        { reg: '^#创建(狼人杀|lrs)$', fnc: 'createGame' },
        { reg: '^#加入(狼人杀|lrs)$', fnc: 'joinGame' },
        { reg: '^#开始(狼人杀|lrs)$', fnc: 'startGame' },
        { reg: '^#结束(狼人杀|lrs)$', fnc: 'endGame' }
      ]
    })
  }

  async createGame (e) {
    return GameController.createGame(e)
  }

  async joinGame (e) {
    return GameController.joinGame(e)
  }

  async startGame (e) {
    return GameController.startGame(e)
  }

  async endGame (e) {
    return GameController.endGame(e)
  }
}
