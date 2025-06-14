import { GameManager } from '../GameManager.js';
import { GameError } from '../core/GameError.js';

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
  static async handle(e, config) {
    const {
      checkGame = true,
      checkPlayer = true,
      checkAlive = false,
      allowedStates = [],
      role: requiredRole = null,
      target: targetConfig = null,
      action,
    } = config;

    try {
      let game = null;
      if (checkGame) {
        game = GameManager.getGame(e.group_id);
        if (!game) {
          throw new GameError('当前群没有进行中的游戏。');
        }
      }

      let player = null;
      if (checkPlayer && game) {
        player = game.getPlayerById(e.user_id);
        if (!player) {
          throw new GameError('你不是游戏中的玩家。');
        }
      }
      
      if (checkAlive && player && !player.isAlive) {
        throw new GameError('死亡玩家无法执行此操作。');
      }

      const currentState = game ? game.getCurrentState() : null;
      if (allowedStates.length > 0 && !allowedStates.some(StateClass => currentState instanceof StateClass)) {
        throw new GameError('当前阶段不能执行此操作。');
      }

      let roleInstance = null;
      if (requiredRole && player) {
        roleInstance = game.roles.get(player.id);
        if (!roleInstance || roleInstance.constructor.name !== requiredRole) {
          throw new GameError(`你不是指定的角色，无法执行此操作。`);
        }
      }

      let targetPlayer = null;
      if (targetConfig && targetConfig.required) {
        const targetId = targetConfig.parse(e.msg);
        if (!targetId) {
          throw new GameError('无效的目标，请指定正确的玩家编号。');
        }
        targetPlayer = game.getPlayerByNumber(targetId);
        if (!targetPlayer) {
          throw new GameError('目标玩家不存在。');
        }
      }

      await action({ game, player, role: roleInstance, targetPlayer, currentState });

      return true;

    } catch (err) {
      if (err instanceof GameError) {
        e.reply(err.message);
      } else {
        console.error('[ActionHandler] Unexpected error:', err);
        e.reply('操作失败，发生了未知错误。');
      }
      return false;
    }
  }
} 