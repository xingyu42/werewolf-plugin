/**
 * @file MockBot.js
 * @description 模拟 Bot 环境，用于端到端游戏流程测试
 * @module tests/e2e/MockBot
 *
 * 核心功能：
 * - 模拟多玩家消息发送
 * - 捕获群聊和私聊消息
 * - 提供消息断言工具
 */

/**
 * 模拟玩家类
 */
export class MockPlayer {
  constructor (id, name) {
    this.id = id
    this.name = name
    this.privateMessages = []
  }

  /**
   * 获取最后一条私聊消息
   */
  getLastPrivateMessage () {
    return this.privateMessages[this.privateMessages.length - 1] || null
  }

  /**
   * 获取所有私聊消息
   */
  getAllPrivateMessages () {
    return [...this.privateMessages]
  }

  /**
   * 清空私聊消息记录
   */
  clearPrivateMessages () {
    this.privateMessages = []
  }

  /**
   * 检查是否收到包含特定内容的私聊
   */
  hasPrivateMessageContaining (text) {
    return this.privateMessages.some(msg =>
      typeof msg === 'string' ? msg.includes(text) : JSON.stringify(msg).includes(text)
    )
  }
}

/**
 * 模拟 Bot 核心类
 */
export class MockBot {
  constructor (groupId = 100000) {
    this.groupId = groupId
    this.players = new Map() // userId -> MockPlayer
    this.groupMessages = []
    this.messageHandler = null // 外部注入的消息处理器
  }

  /**
   * 注册玩家
   * @param {number} userId 用户ID
   * @param {string} name 玩家名称
   * @returns {MockPlayer}
   */
  registerPlayer (userId, name) {
    const player = new MockPlayer(userId, name)
    this.players.set(userId, player)
    return player
  }

  /**
   * 批量注册玩家
   * @param {Array<{id: number, name: string}>} playerList
   */
  registerPlayers (playerList) {
    return playerList.map(p => this.registerPlayer(p.id, p.name))
  }

  /**
   * 获取玩家
   */
  getPlayer (userId) {
    return this.players.get(userId)
  }

  /**
   * 创建模拟事件对象
   * @param {number} userId 发送者ID
   * @param {string} msg 消息内容
   * @returns {object} 模拟的事件对象
   */
  createEvent (userId, msg) {
    const player = this.players.get(userId)
    const self = this

    return {
      group_id: this.groupId,
      user_id: userId,
      msg,
      message: msg,
      member: {
        card: player?.name || `Player${userId}`,
        nickname: player?.name || `Player${userId}`
      },
      sender: {
        nickname: player?.name || `Player${userId}`
      },
      reply: (content) => {
        self.groupMessages.push({
          type: 'reply',
          content,
          timestamp: Date.now()
        })
        return Promise.resolve(true)
      },
      bot: {
        pickFriend: (targetId) => ({
          sendMsg: (content) => {
            const target = self.players.get(targetId)
            if (target) {
              target.privateMessages.push(content)
            } else {
              // 玩家不存在也记录，防止丢失消息
              console.warn(`[MockBot] Private message to unknown player ${targetId}:`, content)
            }
            return Promise.resolve(true)
          }
        })
      }
    }
  }

  /**
   * 设置消息处理器
   * @param {Function} handler (event) => Promise<void>
   */
  setMessageHandler (handler) {
    this.messageHandler = handler
  }

  /**
   * 模拟玩家发送消息
   * @param {number} userId 发送者ID
   * @param {string} msg 消息内容
   */
  async send (userId, msg) {
    if (!this.messageHandler) {
      throw new Error('Message handler not set. Call setMessageHandler first.')
    }
    const event = this.createEvent(userId, msg)
    await this.messageHandler(event)
    return event
  }

  /**
   * 获取最后一条群消息
   */
  getLastGroupMessage () {
    const last = this.groupMessages[this.groupMessages.length - 1]
    return last?.content || null
  }

  /**
   * 获取所有群消息
   */
  getAllGroupMessages () {
    return this.groupMessages.map(m => m.content)
  }

  /**
   * 检查群消息是否包含特定内容
   */
  hasGroupMessageContaining (text) {
    return this.groupMessages.some(m => {
      const content = m.content
      return typeof content === 'string'
        ? content.includes(text)
        : JSON.stringify(content).includes(text)
    })
  }

  /**
   * 清空所有消息记录
   */
  clearMessages () {
    this.groupMessages = []
    this.players.forEach(p => p.clearPrivateMessages())
  }

  /**
   * 获取消息统计
   */
  getStats () {
    let totalPrivate = 0
    this.players.forEach(p => { totalPrivate += p.privateMessages.length })
    return {
      groupMessages: this.groupMessages.length,
      privateMessages: totalPrivate,
      playerCount: this.players.size
    }
  }

  /**
   * 打印调试信息
   */
  debug () {
    console.log('=== MockBot Debug ===')
    console.log(`Group ID: ${this.groupId}`)
    console.log(`Players: ${this.players.size}`)
    console.log(`Group Messages: ${this.groupMessages.length}`)
    this.players.forEach((p, id) => {
      console.log(`  Player ${id} (${p.name}): ${p.privateMessages.length} private messages`)
    })
    console.log('====================')
  }
}

export default MockBot
