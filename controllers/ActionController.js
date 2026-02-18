/**
 * @file ActionController.js
 * @description 行动控制器，处理玩家行动验证和分发
 * @module controllers/ActionController
 *
 * @input GameController, ValidationUtils, GameError, ACTIONS, 各状态类
 * @output ActionController - 行动控制器类
 * @pos 控制器层 - 玩家行动验证和分发
 *
 * @dependencies
 * - ./GameController.js - 游戏控制器
 * - ../utils/Validator.js - 验证工具
 * - ../utils/GameError.js - 游戏错误
 * - ../models/Constants.js - 行动常量
 * - ../models/states/*.js - 状态类
 */
import { GameController } from './GameController.js'
import { ValidationUtils } from '../utils/Validator.js'
import { GameError } from '../utils/GameError.js'
import { ACTIONS } from '../models/Constants.js'

import { VoteState } from '../models/states/VoteState.js'
import { LastWordsState } from '../models/states/LastWordsState.js'
import { SheriffElectState } from '../models/states/SheriffElectState.js'
import { SheriffTransferState } from '../models/states/SheriffTransferState.js'
import { DayState } from '../models/states/DayState.js'

export class ActionController {
  static _getGameOrReply (e) {
    const game = GameController.getGame(e.group_id) || GameController.getGameByPlayer(e.user_id)
    if (!game) {
      e.reply('当前群没有进行中的游戏。')
      return null
    }
    return game
  }

  static _getPlayerOrReply (e, game) {
    const validation = ValidationUtils.validateGamePlayer(game, e.user_id)
    if (!validation.isValid) {
      e.reply(validation.error?.message || '你不在本局游戏中')
      return null
    }
    return validation.player
  }

  static _assertAliveOrReply (e, player) {
    const validation = ValidationUtils.validatePlayer(player, { checkAlive: true })
    if (!validation.isValid) {
      e.reply(validation.error?.message || '你已死亡，无法操作')
      return false
    }
    return true
  }

  static _assertStateOrReply (e, game, allowedStates) {
    const validation = ValidationUtils.validateGameState(game, allowedStates)
    if (!validation.isValid) {
      e.reply(validation.error?.message || '当前阶段不能执行此操作')
      return false
    }
    return true
  }

  static _assertActionAllowedOrReply (e, game, player, action, data) {
    const state = game.stateMachine?.getCurrentState?.()
    if (!state || typeof state.isValidAction !== 'function') return true

    const ok = state.isValidAction(player, action, data)
    if (!ok) {
      const reason = typeof state.getInvalidActionReason === 'function'
        ? state.getInvalidActionReason(player, action, data)
        : '当前状态不允许此操作'
      e.reply(reason)
      return false
    }
    return true
  }

  static vote (e, targetNumber = null) {
    const game = this._getGameOrReply(e)
    if (!game) return false

    const player = this._getPlayerOrReply(e, game)
    if (!player) return false
    if (!this._assertAliveOrReply(e, player)) return false
    if (!this._assertStateOrReply(e, game, [VoteState])) return false

    const num = targetNumber ?? e.msg?.match(/(\d+)号/)?.[1]
    const target = game.getPlayerByNumber(num)
    if (!target) {
      e.reply('目标玩家不存在，请指定正确的玩家编号。')
      return false
    }

    if (!this._assertActionAllowedOrReply(e, game, player, ACTIONS.VOTE, target.id)) return false

    game.handleAction(player, ACTIONS.VOTE, target.id).catch(err => {
      e.reply(err instanceof GameError ? err.message : '操作失败，发生了未知错误。')
    })
    return true
  }

  static abstain (e) {
    const game = this._getGameOrReply(e)
    if (!game) return false

    const player = this._getPlayerOrReply(e, game)
    if (!player) return false
    if (!this._assertAliveOrReply(e, player)) return false
    if (!this._assertStateOrReply(e, game, [VoteState])) return false

    if (!this._assertActionAllowedOrReply(e, game, player, ACTIONS.ABSTAIN)) return false

    game.handleAction(player, ACTIONS.ABSTAIN).catch(err => {
      e.reply(err instanceof GameError ? err.message : '操作失败，发生了未知错误。')
    })
    return true
  }

  static handleSkip (e) {
    const game = this._getGameOrReply(e)
    if (!game) return false

    const player = this._getPlayerOrReply(e, game)
    if (!player) return false
    if (!this._assertStateOrReply(e, game, [LastWordsState])) return false

    if (!this._assertActionAllowedOrReply(e, game, player, ACTIONS.SKIP)) return false

    game.handleAction(player, ACTIONS.SKIP).catch(err => {
      e.reply(err instanceof GameError ? err.message : '操作失败，发生了未知错误。')
    })
    return true
  }

  static sheriffElect (e) {
    const game = this._getGameOrReply(e)
    if (!game) return false

    const player = this._getPlayerOrReply(e, game)
    if (!player) return false
    if (!this._assertAliveOrReply(e, player)) return false
    if (!this._assertStateOrReply(e, game, [SheriffElectState])) return false

    if (!this._assertActionAllowedOrReply(e, game, player, ACTIONS.REGISTER)) return false

    game.handleAction(player, ACTIONS.REGISTER).catch(err => {
      e.reply(err instanceof GameError ? err.message : '操作失败，发生了未知错误。')
    })
    return true
  }

  static sheriffTransfer (e, targetNumber = null) {
    const game = this._getGameOrReply(e)
    if (!game) return false

    const player = this._getPlayerOrReply(e, game)
    if (!player) return false
    if (!this._assertStateOrReply(e, game, [SheriffTransferState])) return false

    if (!player.isSheriff) {
      e.reply('只有警长可以移交警徽')
      return false
    }

    const num = targetNumber ?? e.msg?.match(/(\d+)号/)?.[1]
    const target = game.getPlayerByNumber(num)
    if (!target) {
      e.reply('目标玩家不存在，请指定正确的玩家编号。')
      return false
    }

    if (!this._assertActionAllowedOrReply(e, game, player, ACTIONS.TRANSFER, target.id)) return false

    game.handleAction(player, ACTIONS.TRANSFER, target.id).catch(err => {
      e.reply(err instanceof GameError ? err.message : '操作失败，发生了未知错误。')
    })
    return true
  }

  static giveupTransfer (e) {
    const game = this._getGameOrReply(e)
    if (!game) return false

    const player = this._getPlayerOrReply(e, game)
    if (!player) return false
    if (!this._assertStateOrReply(e, game, [SheriffTransferState])) return false

    if (!player.isSheriff) {
      e.reply('只有警长可以放弃移交警徽')
      return false
    }

    if (!this._assertActionAllowedOrReply(e, game, player, ACTIONS.GIVEUP)) return false

    game.handleAction(player, ACTIONS.GIVEUP).catch(err => {
      e.reply(err instanceof GameError ? err.message : '操作失败，发生了未知错误。')
    })
    return true
  }

  static support (e, targetNumber = null) {
    const game = this._getGameOrReply(e)
    if (!game) return false

    const player = this._getPlayerOrReply(e, game)
    if (!player) return false
    if (!this._assertAliveOrReply(e, player)) return false
    if (!this._assertStateOrReply(e, game, [SheriffElectState])) return false

    const num = targetNumber ?? e.msg?.match(/(\d+)号/)?.[1]
    const target = game.getPlayerByNumber(num)
    if (!target) {
      e.reply('目标玩家不存在，请指定正确的玩家编号。')
      return false
    }

    // SheriffElectState uses 'vote' as the support action
    if (!this._assertActionAllowedOrReply(e, game, player, ACTIONS.VOTE, target.id)) return false

    game.handleAction(player, ACTIONS.VOTE, target.id).catch(err => {
      e.reply(err instanceof GameError ? err.message : '操作失败，发生了未知错误。')
    })
    return true
  }

  static wolfDiscuss (e, message) {
    const game = this._getGameOrReply(e)
    if (!game) return false

    const player = this._getPlayerOrReply(e, game)
    if (!player) return false
    if (!this._assertAliveOrReply(e, player)) return false

    const content = (message ?? e.msg?.match(/^#讨论(.*)$/)?.[1])?.trim()
    if (!content) {
      e.reply('讨论内容不能为空')
      return false
    }

    if (!this._assertActionAllowedOrReply(e, game, player, 'discuss', content)) return false

    game.handleAction(player, 'discuss', content).catch(err => {
      e.reply(err instanceof GameError ? err.message : '操作失败，发生了未知错误。')
    })
    return true
  }

  static endSpeech (e) {
    const game = this._getGameOrReply(e)
    if (!game) return false

    const player = this._getPlayerOrReply(e, game)
    if (!player) return false
    if (!this._assertAliveOrReply(e, player)) return false

    const state = game.stateMachine?.getCurrentState?.()
    if (!state) {
      e.reply('游戏尚未开始或已结束')
      return false
    }

    // DayState historically implements `handleEndSpeech` instead of `handleAction`.
    if (state instanceof DayState && typeof state.handleEndSpeech === 'function') {
      state.handleEndSpeech(player).catch(() => e.reply('结束发言失败'))
      return true
    }

    if (!this._assertActionAllowedOrReply(e, game, player, ACTIONS.END_SPEECH)) return false

    game.handleAction(player, ACTIONS.END_SPEECH).catch(err => {
      e.reply(err instanceof GameError ? err.message : '操作失败，发生了未知错误。')
    })
    return true
  }

  static roleAction (e, actionType, targetNumber = null) {
    const normalized = String(actionType || '').trim().toLowerCase()
    if (normalized === 'shoot') return this.shoot(e, targetNumber)

    const game = this._getGameOrReply(e)
    if (!game) return false

    const player = this._getPlayerOrReply(e, game)
    if (!player) return false
    if (!this._assertAliveOrReply(e, player)) return false

    const actionMap = {
      check: ACTIONS.CHECK,
      guard: ACTIONS.PROTECT,
      protect: ACTIONS.PROTECT,
      save: ACTIONS.SAVE,
      poison: ACTIONS.POISON,
      kill: ACTIONS.KILL,
      suicide: ACTIONS.SUICIDE,
      skip: ACTIONS.SKIP
    }

    const action = actionMap[normalized]
    if (!action) {
      e.reply('未知技能类型')
      return false
    }

    const num = targetNumber ?? e.msg?.match(/(\d+)号/)?.[1]
    let targetId = null

    if (num !== null && num !== undefined) {
      const target = game.getPlayerByNumber(num)
      if (!target) {
        e.reply('目标玩家不存在，请指定正确的玩家编号。')
        return false
      }
      targetId = target.id
    }

    if (!this._assertActionAllowedOrReply(e, game, player, action, targetId)) return false

    game.handleAction(player, action, targetId).catch(err => {
      e.reply(err instanceof GameError ? err.message : '操作失败，发生了未知错误。')
    })
    return true
  }

  static async shoot (e, targetNumber = null) {
    const game = this._getGameOrReply(e)
    if (!game) return false

    const player = this._getPlayerOrReply(e, game)
    if (!player) return false

    const role = game.roles?.get?.(player.id)
    if (!role || role.constructor?.name !== 'HunterRole') {
      e.reply('只有猎人可以开枪')
      return false
    }

    if (typeof role.canAct === 'function' && !role.canAct()) {
      e.reply('当前无法开枪')
      return false
    }

    const num = targetNumber ?? e.msg?.match(/(\d+)号/)?.[1]
    if (!num) {
      e.reply('请指定正确的玩家编号。')
      return false
    }

    const target = game.getPlayerByNumber(num)
    if (!target) {
      e.reply('目标玩家不存在，请指定正确的玩家编号。')
      return false
    }
    if (!target.isAlive) {
      e.reply('目标玩家已死亡')
      return false
    }
    if (target.id === player.id) {
      e.reply('不能对自己开枪')
      return false
    }

    try {
      if (Object.prototype.hasOwnProperty.call(role, 'canShoot')) role.canShoot = false
    } catch {}

    try {
      await game.handlePlayerDeath(target, 'HUNTER_SHOT')
      await e.reply(`猎人 ${player.name} 开枪射杀了 ${target.name}`)
      return true
    } catch (err) {
      e.reply(err instanceof GameError ? err.message : '开枪失败，发生了未知错误。')
      return false
    }
  }
}
