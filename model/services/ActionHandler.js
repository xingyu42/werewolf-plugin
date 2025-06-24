import { GameRegistry } from './GameRegistry.js'
import { GameError } from '../core/GameError.js'
import { ValidationUtils } from '../core/ValidationUtils.js'

export class ActionHandler {
  /**
   * 统一处理玩家行动的静态方法
   * @param {object} e - The event object from the chat.
   * @param {object} config - Configuration for the action.
   * @param {boolean} [config.checkGame=true] - Whether to check for an ongoing game.
   * @param {boolean} [config.checkPlayer=true] - Whether to check if the user is a player.
   * @param {boolean} [config.checkAlive=false] - Whether to check if the player is alive.
   * @param {Array<Function>} [config.allowedStates=[]] - Array of allowed state classes.
   * @param {string} [config.role=null] - The required role name for the action.
   * @param {{required: boolean, parse: Function}} [config.target=null] - Target player configuration.
   * @param {Function} config.action - The core logic to execute.
   */
  static async handle (e, config) {
    const {
      checkGame = true,
      checkPlayer = true,
      checkAlive = false,
      allowedStates = [],
      role: requiredRole = null,
      target: targetConfig = null,
      action
    } = config

    try {
      let game = null
      if (checkGame) {
        game = GameRegistry.getGame(e.group_id)
        if (!game) {
          throw new GameError('当前群没有进行中的游戏。')
        }
      }

      let player = null
      if (checkPlayer && game) {
        // 使用 ValidationUtils 验证游戏和玩家关系
        const gamePlayerValidation = ValidationUtils.validateGamePlayer(game, e.user_id)
        if (!gamePlayerValidation.isValid) {
          throw gamePlayerValidation.error
        }
        player = gamePlayerValidation.player
      }

      // 使用 ValidationUtils 验证玩家状态
      if (checkAlive && player) {
        const playerValidation = ValidationUtils.validatePlayer(player, { checkAlive: true })
        if (!playerValidation.isValid) {
          throw playerValidation.error
        }
      }

      // 使用 ValidationUtils 验证游戏状态
      if (allowedStates.length > 0 && game) {
        const stateValidation = ValidationUtils.validateGameState(game, allowedStates)
        if (!stateValidation.isValid) {
          throw stateValidation.error
        }
      }

      let roleInstance = null
      if (requiredRole && player) {
        // 使用 ValidationUtils 验证角色
        const roleValidation = ValidationUtils.validateRole(game, player.id, requiredRole)
        if (!roleValidation.isValid) {
          throw roleValidation.error
        }
        roleInstance = roleValidation.role
      }

      let targetPlayer = null
      if (targetConfig && targetConfig.required) {
        const targetId = targetConfig.parse(e.msg)
        if (!targetId) {
          throw new GameError('无效的目标，请指定正确的玩家编号。')
        }

        // 使用 ValidationUtils 验证目标玩家
        const targetValidation = ValidationUtils.validateGamePlayer(game, targetId)
        if (!targetValidation.isValid) {
          throw new GameError('目标玩家不存在。')
        }
        targetPlayer = targetValidation.player
      }

      const currentState = game?.state
      await action({ game, player, role: roleInstance, targetPlayer, currentState })

      return true
    } catch (err) {
      if (err instanceof GameError) {
        e.reply(err.message)
      } else {
        console.error('[ActionHandler] Unexpected error:', err)
        e.reply('操作失败，发生了未知错误。')
      }
      return false
    }
  }
}
