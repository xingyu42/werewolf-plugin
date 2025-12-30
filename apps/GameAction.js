/**
 * @file GameAction.js
 * @description 游戏行动处理应用，处理投票、弃票、竞选警长等游戏行动命令
 * @module apps/GameAction
 *
 * @input LastWordsState, SheriffElectState, SheriffTransferState, WolfRole, GameError, ActionHandler, ACTIONS
 * @output GameAction - 继承 plugin 的应用类
 * @pos 应用层 - 处理游戏进行中的玩家行动
 *
 * @dependencies
 * - ../model/strategies/states/LastWordsState.js - 遗言状态
 * - ../model/strategies/states/SheriffElectState.js - 警长竞选状态
 * - ../model/strategies/states/SheriffTransferState.js - 警长移交状态
 * - ../model/strategies/roles/WolfRole.js - 狼人角色
 * - ../model/core/GameError.js - 游戏错误类
 * - ../model/cqrs/ActionHandler.js - 行动处理器
 * - ../model/core/Constants.js - 常量定义
 */
import { LastWordsState } from '../model/strategies/states/LastWordsState.js' // 引入 LastWordsState
import { SheriffElectState } from '../model/strategies/states/SheriffElectState.js' // 引入 SheriffElectState
import { SheriffTransferState } from '../model/strategies/states/SheriffTransferState.js' // 引入 SheriffTransferState
import { WolfRole } from '../model/strategies/roles/WolfRole.js' // 引入 WolfRole
import { GameError } from '../model/core/GameError.js'
import { ActionHandler } from '../model/cqrs/ActionHandler.js'
import { ACTIONS } from '../model/core/Constants.js'

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

  async handleVote (e) {
    await ActionHandler.handle(e, {
      checkAlive: true,
      target: {
        required: true,
        parse: (msg) => msg.match(/(\\d+)号/)?.[1]
      },
      action: async ({ game, player, targetPlayer }) => {
        await game.handleAction(player, ACTIONS.VOTE, targetPlayer.id)
      }
    })
  }

  async handleAbstain (e) {
    await ActionHandler.handle(e, {
      checkAlive: true,
      action: async ({ game, player }) => {
        await game.handleAction(player, ACTIONS.ABSTAIN)
      }
    })
  }

  async handleSkip (e) {
    await ActionHandler.handle(e, {
      allowedStates: [LastWordsState],
      action: async ({ game, player }) => {
        await game.handleAction(player, ACTIONS.SKIP)
      }
    })
  }

  async handleSheriffElect (e) {
    await ActionHandler.handle(e, {
      checkAlive: true,
      allowedStates: [SheriffElectState],
      action: async ({ game, player }) => {
        await game.handleAction(player, ACTIONS.REGISTER)
      }
    })
  }

  async handleSheriffTransfer (e) {
    await ActionHandler.handle(e, {
      checkAlive: true,
      allowedStates: [SheriffTransferState],
      target: {
        required: true,
        parse: (msg) => msg.match(/(\\d+)号/)?.[1]
      },
      action: async ({ game, player, targetPlayer }) => {
        if (!player.isSheriff) throw new GameError('只有警长可以移交警徽')
        await game.handleAction(player, ACTIONS.TRANSFER, targetPlayer.id)
      }
    })
  }

  async handleGiveupTransfer (e) {
    await ActionHandler.handle(e, {
      checkAlive: true,
      allowedStates: [SheriffTransferState],
      action: async ({ game, player }) => {
        if (!player.isSheriff) throw new GameError('只有警长可以放弃移交警徽')
        await game.handleAction(player, ACTIONS.GIVEUP)
      }
    })
  }

  async handleSupport (e) {
    await ActionHandler.handle(e, {
      checkAlive: true,
      allowedStates: [SheriffElectState],
      target: {
        required: true,
        parse: (msg) => msg.match(/(\\d+)号/)?.[1]
      },
      action: async ({ game, player, targetPlayer }) => {
        await game.handleAction(player, ACTIONS.SUPPORT, targetPlayer.id)
      }
    })
  }

  async wolfDiscuss (e) {
    await ActionHandler.handle(e, {
      checkAlive: true,
      action: async ({ game, player }) => {
        const role = game.roles.get(player.id)
        if (!(role instanceof WolfRole)) {
          throw new GameError('你不是狼人，无法参与讨论')
        }
        const content = e.msg.match(/^#讨论(.*)$/)?.[1]?.trim()
        if (!content) {
          throw new GameError('讨论内容不能为空')
        }
        await role.discuss(content)
      }
    })
  }

  async handleEndSpeech (e) {
    await ActionHandler.handle(e, {
      checkGame: true,
      checkPlayer: true,
      action: async ({ game, player }) => {
        await game.handleAction(player, ACTIONS.END_SPEECH)
      }
    })
  }
}
