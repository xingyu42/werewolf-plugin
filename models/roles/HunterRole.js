/**
 * @file HunterRole.js
 * @description 猎人角色类，好人阵营的特殊角色
 * @module model/strategies/roles/HunterRole
 *
 * @input Role
 * @output HunterRole - 猎人角色类
 * @pos 策略层 - 猎人角色，死亡时开枪
 *
 * @dependencies
 * - ./Role.js - 角色基类
 */
import { Role } from './Role.js'

/**
 * 猎人角色类
 *
 * 猎人是好人阵营的特殊角色，具有以下能力：
 * - 死亡时可以开枪射杀一名玩家（根据死亡原因决定是否可以开枪）
 * - 被狼人杀死或被放逐时可以开枪
 * - 被毒杀时不能开枪
 * - 只能开枪一次
 *
 * @class HunterRole
 * @extends Role
 */
export class HunterRole extends Role {
  /**
   * 创建猎人角色实例
   *
   * @param {Object} game - 游戏实例
   * @param {Object} player - 玩家对象
   * @param {Object} e - 事件对象
   */
  constructor (game, player, e) {
    super(game, player, e)
    this.canShoot = true // 是否可以开枪
    this.name = '猎人' // 添加角色名称
  }

  /**
   * 检查猎人是否可以开枪
   *
   * 猎人可以在死亡时开枪，但需要根据死亡原因判断
   *
   * @returns {boolean} 是否可以开枪
   */
  canAct () {
    // 猎人必须已死亡且有开枪权限
    if (!this.canShoot || this.player.isAlive) return false
    // 根据死亡原因判断
    switch (this.player.deathReason) {
      case 'WOLF_KILL': // 被狼人杀死
      case 'EXILE': // 被放逐
        return true
      case 'POISON': // 被毒杀
        return false
      default:
        return false
    }
  }

  /**
   * 获取猎人开枪提示消息
   *
   * @async
   * @returns {Promise<boolean>} 总是返回true
   */
  async getActionPrompt () {
    const currentState = this.game.getCurrentState()
    if (!this.canAct(currentState)) return true

    let msg = '【猎人】你已死亡，请开枪射向其他玩家.\n'

    // 获取存活玩家列表
    const playersList = this.getAlivePlayersList()

    msg += playersList
    msg += '\n\n输入：#开枪*号'

    await this.sendPrivate(msg)
    return true
  }

  /**
   * 处理目标ID，移除"号"字符并验证格式
   *
   * @param {string} targetId - 原始目标ID
   * @returns {string} 处理后的目标ID
   * @throws {Error} 如果目标ID格式无效
   */
  processTargetId (targetId) {
    if (!targetId || typeof targetId !== 'string') {
      throw new Error('无效的目标ID格式')
    }

    // 移除可能的"号"字符
    targetId = targetId.replace(/号$/, '')

    // 检查是否为数字
    if (!/^\d+$/.test(targetId)) {
      throw new Error('目标ID必须为数字')
    }

    return targetId
  }

  /**
   * 检查开枪目标是否合法 - 返回验证结果对象
   *
   * @param {string} rawTargetId - 原始目标ID字符串
   * @returns {Object} 验证结果对象 {isValid: boolean, message: string}
   */
  isValidTarget (rawTargetId) {
    if (!this.canAct()) {
      return { isValid: false, message: '当前无法开枪' }
    }

    try {
      const targetId = this.processTargetId(rawTargetId)

      // 检查目标是否存在
      const target = this.game.players.get(targetId)
      if (!target) {
        return { isValid: false, message: '目标玩家不存在' }
      }
      return { isValid: true, message: '' }
    } catch (err) {
      return { isValid: false, message: err.message }
    }
  }

  /**
   * 猎人开枪执行方法
   *
   * @async
   * @param {string} rawTargetId - 目标玩家ID字符串
   * @returns {Promise<boolean>} 开枪是否成功
   */
  async act (rawTargetId) {
    try {
      const validation = this.isValidTarget(rawTargetId)

      if (!validation.isValid) {
        await this.e.reply(`开枪失败: ${validation.message}`)
        return false
      }

      const targetId = this.processTargetId(rawTargetId)
      const target = this.game.players.get(targetId)

      // 使用开枪能力
      this.canShoot = false

      // 调用玩家死亡处理方法
      await this.game.handlePlayerDeath(target, 'HUNTER_SHOT')

      // 发送消息
      await this.e.reply(`猎人 ${this.player.name} 开枪射杀了 ${target.name}`)

      return true
    } catch (err) {
      console.error('猎人开枪失败:', err)
      await this.e.reply(`开枪失败: ${err.message}`)
      return false
    }
  }
}
