import { DEATH_REASONS } from './Constants.js'

/**
 * 统一通知中心 - 替代GameEventHandler的事件驱动机制
 * 负责处理所有游戏通知和消息发送，采用直接调用而非事件系统
 */
export class NotificationCenter {
  /**
   * 创建通知中心
   * @param {Object} e 通信句柄
   */
  constructor (e) {
    this.e = e
    this.errorCount = 0
    this.isCleanedUp = false
  }

  /**
   * 通知游戏结束
   * @param {string} winner 获胜阵营
   * @param {string} reason 胜利原因
   * @param {string} alivePlayers 存活玩家信息
   */
  async notifyGameEnd (winner, reason, alivePlayers) {
    if (this.isCleanedUp) return

    try {
      const message = `游戏结束！\n获胜阵营：${winner}\n胜利原因：${reason}\n存活玩家：\n${alivePlayers}`
      await this.e.reply(message)
      console.log('[NotificationCenter] 游戏结束通知发送成功')
    } catch (error) {
      console.error('[NotificationCenter] 发送游戏结束通知失败:', error)
    }
  }

  /**
   * 通知新的一天开始
   * @param {number} turn 当前轮次
   */
  async notifyNewDay (turn) {
    if (this.isCleanedUp) return

    try {
      await this.e.reply(`=== 第${turn}天 ===`)
      console.log(`[NotificationCenter] 第${turn}天开始通知发送成功`)
    } catch (error) {
      console.error('[NotificationCenter] 发送新一天通知失败:', error)
    }
  }

  /**
   * 通知玩家死亡
   * @param {Object} player 死亡玩家
   * @param {string} reason 死亡原因
   */
  async notifyPlayerDeath (player, reason) {
    if (this.isCleanedUp) return

    try {
      let deathMessage = `玩家 ${player.gameNumber}号 ${player.name} 已死亡`

      // 根据死亡原因提供不同的消息
      switch (reason) {
        case DEATH_REASONS.WOLF_KILL:
          deathMessage += '（被狼人杀死）'
          break
        case DEATH_REASONS.EXILE:
          deathMessage += '（被放逐出村）'
          break
        case DEATH_REASONS.POISON:
          deathMessage += '（中毒身亡）'
          break
        case DEATH_REASONS.HUNTER_SHOT:
          deathMessage += '（被猎人射杀）'
          break
        default:
          console.warn(`[NotificationCenter] 未知的死亡原因: ${reason}`)
      }

      await this.e.reply(deathMessage)
      console.log(`[NotificationCenter] 玩家死亡通知发送成功: ${player.name}`)
    } catch (error) {
      console.error('[NotificationCenter] 发送玩家死亡通知失败:', error)
    }
  }

  /**
   * 通知角色分配
   * @param {string} playerId 玩家ID
   * @param {string} message 角色分配消息
   */
  async notifyRoleAssignment (playerId, message) {
    if (this.isCleanedUp) return

    try {
      await this.e.bot.pickFriend(playerId).sendMsg(message)
      console.log(`[NotificationCenter] 角色分配通知发送成功: ${playerId}`)
    } catch (error) {
      console.warn(`[NotificationCenter] 角色分配通知发送失败 ${playerId}:`, error.message)
    }
  }

  /**
   * 处理游戏错误
   * @param {Error} error 错误对象
   * @param {Object} context 错误上下文
   */
  async handleError (error, context = {}) {
    if (this.isCleanedUp) return

    this.errorCount++
    console.error('[NotificationCenter] 游戏错误:', error, context)

    try {
      // 根据错误类型决定是否通知用户
      if (error.shouldNotifyUser !== false) {
        const errorMessage = `[游戏错误] ${error.message}`
        await this.e.reply(errorMessage)
      }

      // 记录错误统计
      if (global.logger) {
        global.logger.error('游戏错误', {
          error: error.toJSON ? error.toJSON() : error.message,
          context,
          timestamp: new Date().toISOString()
        })
      }
    } catch (notifyError) {
      console.error('[NotificationCenter] 发送错误通知失败:', notifyError)
    }
  }

  /**
   * 发送通用消息
   * @param {string} type 消息类型 ('group' | 'private')
   * @param {string} target 目标（对于私聊消息）
   * @param {string} content 消息内容
   */
  async sendMessage (type, target, content) {
    if (this.isCleanedUp) return

    try {
      if (type === 'group') {
        await this.e.reply(content)
      } else if (type === 'private' && target) {
        await this.e.bot.pickFriend(target).sendMsg(content)
      } else {
        console.warn('[NotificationCenter] 无效的消息类型或目标:', type, target)
      }
    } catch (error) {
      console.error('[NotificationCenter] 发送消息失败:', error)
    }
  }

  /**
   * 获取通知中心统计信息
   */
  getStats () {
    return {
      errorCount: this.errorCount,
      isCleanedUp: this.isCleanedUp
    }
  }

  /**
   * 清理通知中心资源
   */
  cleanup () {
    if (this.isCleanedUp) {
      console.debug('[NotificationCenter] 已经清理过，跳过重复清理')
      return
    }

    console.log('[NotificationCenter] 开始清理通知中心...')

    try {
      // 标记为已清理
      this.isCleanedUp = true

      // 清理统计数据
      this.errorCount = 0

      console.log('[NotificationCenter] 通知中心清理完成')
    } catch (error) {
      console.error('[NotificationCenter] 清理通知中心时发生错误:', error)
    }
  }
}
