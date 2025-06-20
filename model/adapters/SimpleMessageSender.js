/**
 * 简化的消息发送器
 * 替换复杂的MessageRouter和CommunicationAdapter
 * 只保留核心的私聊和群聊发送功能，移除统计、重试、配置等过度设计
 */

export class SimpleMessageSender {
  /**
   * 发送私聊消息，失败自动降级到群聊
   * @param {string} content - 消息内容
   * @param {string} target - 目标玩家ID
   * @param {Object} e - 事件对象
   * @returns {Promise<boolean>} 发送是否成功
   */
  static async sendPrivate (content, target, e) {
    // 参数验证
    if (!content || !target || !e) {
      console.error('[SimpleMessageSender] sendPrivate: 参数不能为空')
      return false
    }

    try {
      if (!e.bot?.pickFriend) {
        throw new Error('Bot对象或pickFriend方法不可用')
      }

      await e.bot.pickFriend(target).sendMsg(content)
      console.log(`[SimpleMessageSender] 私聊发送成功: ${target}`)
      return true
    } catch (error) {
      console.log(`[SimpleMessageSender] 私聊失败，降级到群聊: ${target}`)
      try {
        await e.reply(`@${target} ${content}`)
        return true
      } catch (fallbackError) {
        console.error('[SimpleMessageSender] 群聊降级也失败:', fallbackError)
        return false
      }
    }
  }

  /**
   * 发送群聊消息
   * @param {string} content - 消息内容
   * @param {Object} e - 事件对象
   * @returns {Promise<boolean>} 发送是否成功
   */
  static async sendGroup (content, e) {
    // 参数验证
    if (!content || !e) {
      console.error('[SimpleMessageSender] sendGroup: 参数不能为空')
      return false
    }

    try {
      await e.reply(content)
      console.log('[SimpleMessageSender] 群聊发送成功')
      return true
    } catch (error) {
      console.error('[SimpleMessageSender] 群聊发送失败:', error)
      return false
    }
  }
}
