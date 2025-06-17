import { ValidationUtils } from '../utils/ValidationUtils.js'

export class Role {
  constructor (game, player, e) {
    this.game = game
    this.player = player
    this.e = e
  }

  // 获取角色名称
  getName () {
    return this.player.role
  }

  /**
   * 获取角色阵营
   * @returns {string} 角色阵营
   */
  async getCamp () {
    const { RoleFactory } = await import('./RoleFactory.js')
    return RoleFactory.getRoleCamp(this.player.role)
  }

  // 检查是否可以在当前阶段行动
  canAct (state) {
    return false
  }

  // 执行行动
  async act (target) {
    throw new Error('需要在子类中实现act方法')
  }

  // 获取行动提示
  getActionPrompt () {
    return ''
  }

  // 验证目标是否合法
  isValidTarget (target) {
    // 使用 ValidationUtils 进行统一验证
    const validation = ValidationUtils.validateTarget(target)

    if (!validation.isValid) {
      console.debug(`isValidTarget: ${validation.error.message}`)
      return false
    }

    return true
  }

  // 简洁的消息发送方法
  /**
   * 发送群消息
   * @param {string} message 消息内容
   * @param {boolean} quote 是否引用回复
   * @param {object} options 其他选项
   */
  async reply (message, quote = false, options = {}) {
    if (!this.e) {
      console.warn('[Role] 无法发送群消息：通信对象不可用')
      return false
    }

    if (typeof this.e.reply !== 'function') {
      console.warn('[Role] 无法发送群消息：reply方法不可用')
      return false
    }

    try {
      return await this.e.reply(message, quote, options)
    } catch (error) {
      console.warn('[Role] 群消息发送失败:', error.message)
      return false
    }
  }

  /**
   * 发送私聊消息
   * @param {string} message 消息内容
   * @param {string} userId 用户ID，默认为当前玩家
   */
  async sendPrivate (message, userId = null) {
    const targetId = userId || this.player?.id
    if (!targetId) {
      console.warn('[Role] 无法发送私聊消息：缺少目标用户ID')
      return false
    }

    if (!this.e) {
      console.warn('[Role] 无法发送私聊消息：通信对象不可用')
      return false
    }

    if (!this.e.bot) {
      console.warn('[Role] 无法发送私聊消息：bot对象不可用')
      return false
    }

    try {
      // 优先尝试 pickFriend 方法
      if (typeof this.e.bot.pickFriend === 'function') {
        const friend = await this.e.bot.pickFriend(targetId)
        await friend.sendMsg(message)
        return true
      }

      // 备选方案：尝试 pickUser 方法
      if (typeof this.e.bot.pickUser === 'function') {
        const user = await this.e.bot.pickUser(targetId)
        await user.sendMsg(message)
        return true
      }

      console.warn(`[Role] 私聊API不可用，无法发送消息给用户 ${targetId}`)
      return false
    } catch (error) {
      console.warn(`[Role] 私聊发送失败 ${targetId}:`, error.message)
      return false
    }
  }

  // 获取存活玩家列表
  getAlivePlayersList () {
    // 使用 ValidationUtils 验证游戏对象
    if (!this.game) {
      console.error('getAlivePlayersList: game 对象未初始化')
      return '游戏未初始化'
    }

    if (!this.game.players || typeof this.game.players.values !== 'function') {
      console.error('getAlivePlayersList: game.players 无效')
      return '玩家数据无效'
    }

    try {
      const players = Array.from(this.game.players.values())
        .filter((player) => {
          // 使用 ValidationUtils 验证玩家对象
          const validation = ValidationUtils.validatePlayer(player, { checkAlive: true })
          if (!validation.isValid) {
            console.debug(`getAlivePlayersList: 跳过无效玩家: ${validation.error.message}`)
            return false
          }
          return true
        })
        .map((player) => {
          // 安全的字符串构建
          const gameNumber = player.gameNumber || '?'
          const name = player.name || '未知'
          return `${gameNumber}号 ${name}`
        })

      return players.length > 0 ? players.join('\n') : '暂无存活玩家'
    } catch (error) {
      console.error('getAlivePlayersList: 获取玩家列表时发生错误:', error)
      return '获取玩家列表失败'
    }
  }
}
