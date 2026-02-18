/**
 * @file ProphetRole.js
 * @description 预言家角色类，好人阵营的核心角色
 * @module model/strategies/roles/ProphetRole
 *
 * @input Role, ValidationUtils
 * @output ProphetRole - 预言家角色类
 * @pos 策略层 - 预言家角色，夜晚查验身份
 *
 * @dependencies
 * - ./Role.js - 角色基类
 * - ../../core/ValidationUtils.js - 验证工具
 */
import { Role } from './Role.js'
import { ValidationUtils } from '../../utils/Validator.js'

/**
 * 预言家角色类
 *
 * 预言家是好人阵营的核心角色，具有以下能力：
 * - 每晚可以查验一名玩家的身份（好人或狼人）
 * - 查验结果会记录在历史中供参考
 * - 只能在夜晚阶段行动
 * - 不能查验自己
 *
 * @class ProphetRole
 * @extends Role
 */
export class ProphetRole extends Role {
  /**
   * 创建预言家角色实例
   *
   * @param {Object} game - 游戏实例
   * @param {Object} player - 玩家对象
   * @param {Object} e - 事件对象
   */
  constructor (game, player, e) {
    super(game, player, e)
    this.checkHistory = new Map() // 查验历史记录
  }

  /**
   * 检查是否可以在当前阶段行动
   *
   * @param {Object} state - 当前游戏状态
   * @returns {boolean} 预言家只能在夜晚阶段行动
   */
  canAct (state) {
    const stateName = state?.getName?.() || state?.constructor?.name
    return [
      'NightState',
      'NightPhaseController',
      'InformationPhaseState',
      'EliminationPhaseState',
      'InterventionPhaseState'
    ].includes(stateName)
  }

  /**
   * 获取预言家查验提示消息
   *
   * 包含存活玩家列表和查验历史信息
   *
   * @returns {string} 查验提示消息
   */
  async getActionPrompt () {
    const currentState = this.game.getCurrentState()
    if (!this.canAct(currentState)) {
      await this.sendPrivate('预言家只能在夜晚阶段行动')
      return false
    }
    const alivePlayersList = this.getAlivePlayersList()
    const msg = `【预言家】请选择今晚的查验目标：\n ${alivePlayersList} \n 输入格式：#查验*号 `
    await this.sendPrivate(msg)
    return true
  }

  /**
   * 检查查验目标是否合法
   *
   * @param {Object} target - 目标玩家对象
   * @returns {boolean} 目标是否合法
   */
  isValidTarget (target) {
    if (!super.isValidTarget(target)) return false

    // 不能查验自己
    if (target.id === this.player.id) return false

    return true
  }

  /**
   * 执行预言家查验行动
   *
   * @async
   * @param {Object} target - 查验目标玩家
   * @param {string} [action='check'] - 行动类型，默认为查验
   * @returns {Promise<string|boolean>} 查验结果字符串或false（失败时）
   */
  async act (target, action = 'check') {
    if (!target) {
      console.debug('ProphetRole.act: target 为空')
      return false
    }

    if (!this.isValidTarget(target)) {
      // 提供更具体的错误信息
      if (target.id === this.player.id) {
        await this.e.reply('查验失败: 不能查验自己')
      } else if (!target.isAlive) {
        await this.e.reply(`查验失败: 目标玩家 ${target.name || target.id} 已死亡`)
      } else {
        await this.e.reply(`查验失败: 目标玩家 ${target.name || target.id} 不是有效的查验目标`)
      }
      return false
    }

    try {
      let result
      const timestamp = Date.now()

      // 使用 ValidationUtils 验证角色数据
      const roleValidation = ValidationUtils.validateRole(this.game, target.id)
      if (!roleValidation.isValid) {
        console.error(`ProphetRole.act: ${roleValidation.error.message}`)
        await this.e.reply(`查验失败: 目标角色验证失败 - ${roleValidation.error.message} (玩家ID: ${target.id})`)
        return false
      }

      const targetRole = roleValidation.role

      // 查验阵营
      let isGood
      try {
        const camp = await targetRole.getCamp()
        isGood = camp !== 'WOLF'
      } catch (error) {
        console.error('ProphetRole.act: 获取阵营信息失败:', error)
        await this.e.reply(`查验失败: 无法获取目标阵营信息 - ${error.message || '未知错误'} (目标: ${target.name || target.id})`)
        return false
      }

      const targetName = target.name || '未知玩家'
      result = `${targetName}是${isGood ? '好人' : '狼人'}`

      // 记录查验结果
      if (!this.checkHistory) {
        this.checkHistory = new Map()
      }

      this.checkHistory.set(target.id, {
        result,
        timestamp,
        turn: this.game.turn || 0
      })

      // 发送查验结果
      const turnInfo = this.game.turn || 0
      const timeInfo = new Date(timestamp).toLocaleTimeString()
      await this.e.reply(`${result} (查验时间: 第${turnInfo}天 ${timeInfo})`)

      return result
    } catch (error) {
      console.error('ProphetRole.act: 查验过程中发生错误:', error)
      await this.e.reply(`查验失败: 查验过程中发生异常 - ${error.message || '未知错误'} (目标: ${target.name || target.id}, 时间: ${new Date().toLocaleTimeString()})`)
      return false
    }
  }
}
