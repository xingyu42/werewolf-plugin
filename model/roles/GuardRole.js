import { Role } from './Role.js'

/**
 * 守卫角色类
 *
 * 守卫是好人阵营的特殊角色，具有以下能力：
 * - 每晚可以守护一名玩家，防止其被狼人杀死
 * - 不能连续两晚守护同一个人
 * - 只能在夜晚阶段行动
 *
 * @class GuardRole
 * @extends Role
 */
export class GuardRole extends Role {
  /**
   * 创建守卫角色实例
   *
   * @param {Object} game - 游戏实例
   * @param {Object} player - 玩家对象
   * @param {Object} e - 事件对象
   */
  constructor (game, player, e) {
    super(game, player, e)
    this.name = '守卫'
    this.lastProtectedId = null // 上次守护的玩家ID
  }

  /**
   * 检查是否可以在当前阶段行动
   *
   * @param {Object} state - 当前游戏状态
   * @returns {boolean} 守卫只能在夜晚阶段行动
   */
  canAct (state) {
    return state.getName() === 'NightState'
  }

  /**
   * 获取守卫行动提示消息
   *
   * @async
   * @returns {Promise<boolean|null>} 成功发送提示返回true，无法行动返回null
   */
  async getActionPrompt () {
    if (!this.canAct()) return null

    let msg = '【守卫】请选择今晚的守护目标：\n'

    // 获取存活玩家列表
    const alivePlayers = this.getAlivePlayersList()

    msg += alivePlayers.join('\n')
    msg += '\n\n输入格式：#守护*号'

    // 添加上次守护信息
    if (this.lastProtectedId) {
      const lastPlayer = this.game.players.get(this.lastProtectedId)
      if (lastPlayer) {
        msg += `\n\n你上次守护的是：${lastPlayer.gameNumber}号 ${lastPlayer.name}`
        msg += '\n注意：不能连续两晚守护同一个人'
      }
    }

    await this.sendPrivate(msg)
    return true
  }

  /**
   * 验证守护目标是否合法
   *
   * @param {Object} target - 目标玩家对象
   * @returns {boolean} 目标是否合法
   */
  isValidTarget (target) {
    if (!super.isValidTarget(target)) return false

    // 不能连续两晚守护同一个人
    if (this.lastProtectedId && target.id === this.lastProtectedId) {
      return false
    }

    return true
  }

  /**
   * 执行守护行动
   *
   * @async
   * @param {Object} target - 守护目标玩家
   * @param {string} [action='protect'] - 行动类型，默认为守护
   * @returns {Promise<boolean>} 守护是否成功
   */
  async act (target, action = 'protect') {
    if (!this.isValidTarget(target)) {
      if (target && target.id === this.lastProtectedId) {
        await this.sendPrivate('你不能连续两晚守护同一个人')
      } else {
        await this.sendPrivate('无效的守护目标')
      }
      return false
    }

    // 清除所有玩家的守护状态
    this.game.clearAllProtectedStatus()

    // 设置目标玩家的守护状态
    this.game.setProtectedStatus(target, true)

    // 记录本次守护的玩家ID
    this.lastProtectedId = target.id

    await this.sendPrivate(`你成功守护了 ${target.gameNumber}号 ${target.name}`)
    return true
  }
}
