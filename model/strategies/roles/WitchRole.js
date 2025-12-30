import { Role } from './Role.js'

/**
 * 女巫角色类
 *
 * 女巫是好人阵营的强力角色，具有以下能力：
 * - 拥有一瓶解药，可以救活被狼人杀死的玩家
 * - 拥有一瓶毒药，可以毒杀一名存活玩家
 * - 每晚最多只能使用一种药水
 * - 根据配置决定是否可以自救
 * - 只能在夜晚阶段行动
 *
 * @class WitchRole
 * @extends Role
 */
export class WitchRole extends Role {
  /**
   * 创建女巫角色实例
   *
   * @param {Object} game - 游戏实例
   * @param {Object} player - 玩家对象
   * @param {Object} e - 事件对象
   */
  constructor (game, player, e) {
    super(game, player, e)
    this.name = '女巫'
    this.canSaveSelf = game.getConfig().roles.witchCanSaveSelf // 女巫是否能自救
    this.hasAntidote = true // 拥有解药
    this.hasPoison = true // 拥有毒药
  }

  /**
   * 检查是否可以在当前阶段行动
   *
   * @param {Object} state - 当前游戏状态
   * @returns {boolean} 女巫只能在夜晚阶段行动
   */
  canAct (state) {
    return state.getName() === 'NightState'
  }

  /**
   * 获取女巫行动提示消息
   *
   * 根据当前拥有的药水显示可用选项
   *
   * @async
   * @returns {Promise<boolean>} 是否成功发送提示消息
   */
  async getActionPrompt (e) {
    const currentState = this.game.getCurrentState()
    if (!this.canAct(currentState)) return e.reply('女巫只能在夜晚阶段行动')
    if (!this.hasAntidote && !this.hasPoison) {
      await this.sendPrivate('【女巫】你已经没有药可以使用了')
      return false
    }

    let prompt = '【女巫】请选择要使用的药水,不能同时使用解药和毒药：\n'

    // 如果有解药且今晚有人被狼人杀害
    if (this.hasAntidote) {
      const state = this.game.currentState
      const wolfAction = state.actions.get('WolfRole')
      if (wolfAction && wolfAction.target) {
        const victim = wolfAction.target
        prompt += `1. 使用解药救活：${victim.name}\n   输入格式：#救人\n`
      } else {
        prompt += '1. 今晚没有人被狼人杀害，无法使用解药\n'
      }
    }

    // 如果有毒药
    if (this.hasPoison) {
      const alivePlayersList = this.getAlivePlayersList()
      prompt += `${this.hasAntidote ? '2' : '1'}. 使用毒药毒人：\n${alivePlayersList.join('\n')}\n   输入格式：#毒杀*号\n`
    }

    prompt += '\n也可以选择什么都不做：#跳过'

    await this.sendPrivate(prompt)
    return true
  }

  /**
   * 检查救人目标是否合法
   *
   * @param {Object} target - 目标玩家对象
   * @returns {Object} 验证结果对象 {isValid: boolean, message: string}
   */
  isValidSaveTarget (target) {
    if (!this.hasAntidote) {
      return { isValid: false, message: '救人失败: 你已经没有解药了' }
    }

    if (!target || target.deathReason !== 'WOLF_KILL') {
      const targetName = target ? target.name : '未知目标'
      return { isValid: false, message: `救人失败: ${targetName} 不是被狼人杀死的，无法使用解药` }
    }

    return { isValid: true, message: '' }
  }

  /**
   * 检查毒杀目标是否合法
   *
   * @param {Object} target - 目标玩家对象
   * @returns {Object} 验证结果对象 {isValid: boolean, message: string}
   */
  isValidPoisonTarget (target) {
    if (!this.hasPoison) {
      return { isValid: false, message: '毒杀失败: 你已经没有毒药了' }
    }

    if (!target || !target.isAlive) {
      const targetName = target ? target.name : '未知目标'
      return { isValid: false, message: `毒杀失败: ${targetName} 已经死亡，无法毒杀` }
    }

    return { isValid: true, message: '' }
  }

  /**
   * 执行女巫行动
   *
   * @async
   * @param {Object} target - 行动目标玩家
   * @param {string} action - 行动类型 ('save' 救人, 'poison' 毒杀)
   * @returns {Promise<boolean>} 行动是否成功
   */
  async act (target, action) {
    if (action === 'save') {
      // 验证救人目标
      const validation = this.isValidSaveTarget(target)
      if (!validation.isValid) {
        await this.e.reply(validation.message)
        return false
      }

      // 检查是否能自救
      if (target.id === this.player.id && !this.canSaveSelf) {
        await this.e.reply('你不能对自己使用解药')
        return false
      }

      // 使用解药 - 使用集中化的复活方法
      this.hasAntidote = false
      this.game.revivePlayer(target)
      await this.e.reply(`${this.player.name}使用解药救活了${target.name}`)
      return true
    } else if (action === 'poison') {
      // 验证毒杀目标
      const validation = this.isValidPoisonTarget(target)
      if (!validation.isValid) {
        await this.e.reply(validation.message)
        return false
      }

      // 使用毒药 - 使用集中化的死亡处理方法
      this.hasPoison = false
      await this.game.handlePlayerDeath(target, 'POISON')
      await this.e.reply(`${this.player.name}使用毒药毒杀了${target.name}`)
      return true
    }

    return false
  }

  // 跳过使用药水
  async skip () {
    await this.e.reply(`${this.player.name}选择不使用任何药水`)
    return true
  }
}
