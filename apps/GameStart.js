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
