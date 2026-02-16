/**
 * @file GameAction.js
 * @description 游戏行动应用，处理投票/警长等行动命令
 * @module apps/GameAction
 *
 * @input ActionController
 * @output GameAction - 继承 plugin 的应用类
 * @pos 路由层 - 游戏行动处理
 *
 * @dependencies
 * - ../controllers/ActionController.js - 行动控制器
 */
import { ActionController } from '../controllers/ActionController.js'

export class GameAction extends plugin {
  constructor () {
    super({
      name: '狼人杀行动阶段',
      dsc: '狼人杀行动阶段',
      event: 'message',
      priority: 5,
      rule: [
        { reg: '^#投票(\\d+)号$', fnc: 'handleVote' },
        { reg: '^#弃票$', fnc: 'handleAbstain' },
        { reg: '^#结束遗言$', fnc: 'handleSkip' },
        { reg: '^#竞选警长$', fnc: 'handleSheriffElect' },
        { reg: '^#警长移交(\\d+)号$', fnc: 'handleSheriffTransfer' },
        { reg: '^#放弃移交$', fnc: 'handleGiveupTransfer' },
        { reg: '^#支持(\\d+)号$', fnc: 'handleSupport' },
        { reg: '^#讨论(.*)$', fnc: 'wolfDiscuss' },
        { reg: '^#结束发言$', fnc: 'handleEndSpeech' }
      ]
    })
  }

  async handleVote (e) { return ActionController.vote(e) }
  async handleAbstain (e) { return ActionController.abstain(e) }
  async handleSkip (e) { return ActionController.handleSkip(e) }
  async handleSheriffElect (e) { return ActionController.sheriffElect(e) }
  async handleSheriffTransfer (e) { return ActionController.sheriffTransfer(e) }
  async handleGiveupTransfer (e) { return ActionController.giveupTransfer(e) }
  async handleSupport (e) { return ActionController.support(e) }
  async wolfDiscuss (e) { return ActionController.wolfDiscuss(e) }
  async handleEndSpeech (e) { return ActionController.endSpeech(e) }
}
