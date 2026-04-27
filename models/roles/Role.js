/**
 * @file Role.js
 * @description 角色基类，所有游戏角色的抽象基类
 * @module model/strategies/roles/Role
 *
 * @input 无
 * @output Role - 角色抽象基类
 * @pos 策略层 - 角色策略基类，定义角色行为接口
 *
 * @dependencies 无
 */
export class Role {
  /**
   * 创建角色实例
   *
   * @param {Object} game - 游戏实例，提供游戏状态和方法
   * @param {Object} player - 玩家对象，包含玩家基本信息
   * @param {Object} e - 事件对象，用于消息发送和事件处理
   */
  constructor (game, player, e) {
    this.game = game
    this.player = player
    this.e = e
  }

  /**
   * 获取角色名称
   *
   * @returns {string} 角色名称
   */
  getName () {
    return this.player.role
  }

  /**
   * 获取角色阵营
   *
   * @async
   * @returns {Promise<string>} 角色阵营（如 'GOOD', 'WOLF'）
   */
  async getCamp () {
    const { RoleFactory } = await import('./RoleFactory.js')
    return RoleFactory.getRoleCamp(this.player.role)
  }

  /**
   * 检查是否可以在当前阶段行动
   *
   * @param {Object} state - 当前游戏状态对象
   * @returns {boolean} 是否可以行动
   */
  canAct (state) {
    return false
  }

  /**
   * 执行角色行动 - 抽象方法，需要在子类中实现
   *
   * @abstract
   * @async
   * @param {Object} target - 行动目标玩家对象
   * @param {string} [action] - 行动类型
   * @returns {Promise<boolean|Object>} 行动结果
   * @throws {Error} 如果子类未实现此方法
   */
  async act (target) {
    throw new Error('需要在子类中实现act方法')
  }

  /**
   * 获取行动提示消息
   *
   * @returns {string} 行动提示文本
   */
  getActionPrompt () {
    return ''
  }

  /**
   * 验证目标是否合法 - 基础验证
   *
   * @param {Object} target - 目标玩家对象
   * @returns {boolean} 目标是否合法
   */
  isValidTarget (target) {
    if (!target) return false

    // 检查目标是否存活
    return target.isAlive
  }

  /**
   * 发送私聊消息
   *
   * @async
   * @param {string} message - 要发送的消息内容
   * @param {string} [targetId] - 目标玩家ID，默认为当前玩家
   * @returns {Promise<boolean>} 发送是否成功
   */
  async sendPrivate (message, targetId = null) {
    const target = targetId || this.player.id
    try {
      await this.e.bot.pickFriend(target).sendMsg(message)
      return true
    } catch (error) {
      console.error(`[Role] sendPrivate失败 (${target}):`, error.message || error)
      return false
    }
  }

  /**
   * 获取存活玩家列表
   *
   * @returns {string} 存活玩家的显示信息字符串，错误时返回空字符串
   */
  getAlivePlayersList () {
    try {
      if (!this.game) {
        console.error('[Role] getAlivePlayersList: 游戏对象未初始化')
        return ''
      }

      if (!this.game.players) {
        console.error('[Role] getAlivePlayersList: 玩家数据未初始化')
        return ''
      }

      const alivePlayers = Array.from(this.game.players.values()).filter(player => player.isAlive)
      return alivePlayers.map(player => `${player.gameNumber}号 ${player.name}`).join('\n')
    } catch (error) {
      console.error('[Role] getAlivePlayersList: 获取存活玩家列表失败:', error.message || error)
      return ''
    }
  }
}
