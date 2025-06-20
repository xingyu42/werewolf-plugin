import { ErrorHandler } from './ErrorHandler.js'
import { DEATH_REASONS } from './Constants.js'
import { SimpleMessageSender } from '../adapters/SimpleMessageSender.js'

/**
 * 游戏事件处理器 - 负责处理Game实例发出的非消息事件并转发到通信层
 * 处理游戏状态变化事件：gameEnd、newDay、roleNotify、playerDeath、error
 * 消息发送功能已简化，由角色类直接处理
 */
export class GameEventHandler {
  /**
   * 创建游戏事件处理器
   * @param {Game} game 游戏实例
   * @param {Object} e 通信句柄
   * @param {ErrorHandler} errorHandler 错误处理器（可选）
   */
  constructor (game, e, errorHandler = null) {
    this.game = game
    this.e = e
    this.errorHandler = errorHandler || new ErrorHandler(global.logger || console)

    // 事件监听器引用存储，用于清理
    this.eventListeners = new Map()

    // 标记是否已清理
    this.isCleanedUp = false

    // 只有当game不为null时才设置事件监听
    if (this.game) {
      this.setupEventListeners()
    }
  }

  /**
   * 设置游戏引用并初始化事件监听器
   */
  setGame (game) {
    this.game = game
    if (game && this.eventListeners.size === 0) {
      this.setupEventListeners()
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners () {
    // 检查game是否存在
    if (!this.game) {
      console.warn('[GameEventHandler] Game实例不存在，无法设置事件监听器')
      return
    }

    // 防止重复设置监听器
    if (this.eventListeners.size > 0) {
      console.warn('[GameEventHandler] 事件监听器已设置，跳过重复设置')
      return
    }

    // 监听错误事件 - 使用统一错误处理框架
    const errorHandler = (error) => {
      if (this.isCleanedUp) return // 已清理则忽略事件

      // 使用统一错误处理器处理错误
      const context = {
        gameId: this.game.id || 'unknown',
        turn: this.game.turn || 0,
        playerCount: this.game.players ? this.game.players.size : 0,
        currentState: this.game.getCurrentState ? this.game.getCurrentState()?.constructor?.name : 'unknown'
      }

      // 委托给错误处理器
      const result = this.errorHandler.handle(error, context, this.e)

      // 记录错误到游戏实例以供后续分析（保持向后兼容）
      if (this.game.eventErrors) {
        this.game.eventErrors.push({
          timestamp: new Date(),
          error: error.toJSON(),
          handled: result.handled,
          userMessage: result.userMessage
        })

        // 限制错误日志数量，避免内存泄漏
        if (this.game.eventErrors.length > 100) {
          this.game.eventErrors.shift()
        }
      }
    }

    this.game.on('error', errorHandler)
    this.eventListeners.set('error', errorHandler)

    // 监听游戏结束事件
    const gameEndHandler = (data) => {
      if (this.isCleanedUp) return

      const { winner, reason, alivePlayers } = data
      this.e.reply(`游戏结束！\n获胜阵营：${winner}\n胜利原因：${reason}\n存活玩家：\n${alivePlayers}`)

      // 游戏结束后自动清理事件监听器
      setTimeout(() => this.cleanup(), 1000)
    }

    this.game.on('gameEnd', gameEndHandler)
    this.eventListeners.set('gameEnd', gameEndHandler)

    // 监听新一天开始事件
    const newDayHandler = (data) => {
      if (this.isCleanedUp) return

      const { turn } = data
      this.e.reply(`=== 第${turn}天 ===`)
    }

    this.game.on('newDay', newDayHandler)
    this.eventListeners.set('newDay', newDayHandler)

    // 监听角色通知事件
    const roleNotifyHandler = async (data) => {
      if (this.isCleanedUp) return

      const { playerId, message } = data
      try {
        const success = await SimpleMessageSender.sendPrivate(message, playerId, this.e)
        if (!success) {
          console.warn(`[GameEventHandler] 角色通知发送失败 ${playerId}`)
        }
      } catch (error) {
        console.warn(`[GameEventHandler] 角色通知发送异常 ${playerId}:`, error.message)
      }
    }

    this.game.on('roleNotify', roleNotifyHandler)
    this.eventListeners.set('roleNotify', roleNotifyHandler)

    // 监听玩家死亡事件
    const playerDeathHandler = (data) => {
      if (this.isCleanedUp) return

      const { player, reason } = data
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
      }

      this.e.reply(deathMessage)
    }

    this.game.on('playerDeath', playerDeathHandler)
    this.eventListeners.set('playerDeath', playerDeathHandler)
  }

  /**
   * 清理事件监听器和相关资源
   */
  cleanup () {
    if (this.isCleanedUp) {
      console.debug('[GameEventHandler] 已经清理过，跳过重复清理')
      return
    }

    console.log('[GameEventHandler] 开始清理事件监听器...')

    try {
      // 移除所有事件监听器
      for (const [eventName, handler] of this.eventListeners.entries()) {
        if (this.game && typeof this.game.removeListener === 'function') {
          this.game.removeListener(eventName, handler)
        }
      }

      // 清空监听器引用
      this.eventListeners.clear()

      // 标记为已清理
      this.isCleanedUp = true

      console.log('[GameEventHandler] 事件监听器清理完成')
    } catch (error) {
      console.error('[GameEventHandler] 清理事件监听器时发生错误:', error)
    }
  }

  /**
   * 获取事件监听器统计信息
   */
  getStats () {
    return {
      listenerCount: this.eventListeners.size,
      isCleanedUp: this.isCleanedUp,
      registeredEvents: Array.from(this.eventListeners.keys())
    }
  }
}
