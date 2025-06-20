/**
 * 简化的状态通知器
 * 替换复杂的StateNotifier，只保留核心的夜晚开始和白天开始通知功能
 * 移除复杂的通知选项和统计
 */

import { SimpleMessageSender } from './SimpleMessageSender.js'

export class SimpleStateNotifier {
  /**
   * 夜晚开始通知
   * @param {Object} game - 游戏对象
   * @param {Object} e - 事件对象
   */
  static async notifyNightStart (game, e) {
    // 参数验证
    if (!game || !e) {
      console.error('[SimpleStateNotifier] notifyNightStart: 参数不能为空')
      return
    }

    try {
      await SimpleMessageSender.sendGroup('🌙 夜晚降临，请查看私聊消息', e)
    } catch (error) {
      console.error('[SimpleStateNotifier] notifyNightStart 执行失败:', error)
    }
  }

  /**
   * 通知特定角色类型的玩家行动
   * @param {Object} game - 游戏对象
   * @param {string} roleType - 角色类型
   * @param {Object} e - 事件对象
   */
  static async notifyRoleAction (game, roleType, e) {
    // 参数验证
    if (!game || !roleType || !e) {
      console.error('[SimpleStateNotifier] notifyRoleAction: 参数不能为空')
      return
    }

    try {
      // 获取指定角色类型的存活玩家
      const rolePlayers = game.getAlivePlayers({ roleType, includeRole: true })
      if (!rolePlayers || !Array.isArray(rolePlayers) || rolePlayers.length === 0) {
        console.log(`[SimpleStateNotifier] 没有 ${roleType} 类型的存活玩家`)
        return
      }

      for (const { player, role } of rolePlayers) {
        try {
          if (role && typeof role.getActionPrompt === 'function') {
            const prompt = role.getActionPrompt()
            if (prompt) {
              await SimpleMessageSender.sendPrivate(prompt, player.id, e)
            }
          }
        } catch (error) {
          console.warn(`[SimpleStateNotifier] 向 ${roleType} 玩家 ${player.id} 发送行动提示失败:`, error.message)
        }
      }
    } catch (error) {
      console.error(`[SimpleStateNotifier] notifyRoleAction 执行失败 (${roleType}):`, error)
    }
  }

  /**
   * 阶段开始通知
   * @param {Object} game - 游戏对象
   * @param {string} phaseName - 阶段名称
   * @param {string} phaseDescription - 阶段描述
   * @param {Object} e - 事件对象
   */
  static async notifyPhaseStart (game, phaseName, phaseDescription, e) {
    // 参数验证
    if (!game || !phaseName || !e) {
      console.error('[SimpleStateNotifier] notifyPhaseStart: 参数不能为空')
      return
    }

    try {
      const message = `🌙 ${phaseDescription || phaseName}开始，请查看私聊消息`
      await SimpleMessageSender.sendGroup(message, e)
    } catch (error) {
      console.error('[SimpleStateNotifier] notifyPhaseStart 执行失败:', error)
    }
  }

  /**
   * 白天开始通知
   * @param {Object} game - 游戏对象
   * @param {Object} e - 事件对象
   */
  static async notifyDayStart (game, e) {
    // 参数验证
    if (!game || !e) {
      console.error('[SimpleStateNotifier] notifyDayStart: 参数不能为空')
      return
    }

    try {
      const message = `☀️ 第${game.turn || 1}天开始`
      await SimpleMessageSender.sendGroup(message, e)
    } catch (error) {
      console.error('[SimpleStateNotifier] notifyDayStart 执行失败:', error)
    }
  }
}
