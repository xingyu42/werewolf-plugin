/**
 * 干预阶段状态类
 * 继承自NightPhaseState，实现干预阶段的具体逻辑
 * 处理女巫的毒药和解药使用，管理女巫行动的顺序执行（非并行）
 *
 * {{CHENGQI: Action: Added; Timestamp: 2025-06-19 20:15:30 +08:00; Reason: Shrimp Task ID: #19cf6a8e-ace1-479c-a452-00c3d5ae7bc1, 创建干预阶段状态; Principle_Applied: SOLID-SRP-SingleResponsibility-LSP-LiskovSubstitution;}}
 */

import { NightPhaseState } from './NightPhaseState.js'
import { GameError } from '../core/GameError.js'
import { NIGHT_PHASE_CONFIG, ACTIONS } from '../core/Constants.js'

export class InterventionPhaseState extends NightPhaseState {
  constructor (game) {
    // 使用干预阶段的配置
    super(game, NIGHT_PHASE_CONFIG.INTERVENTION)

    // 干预阶段特有属性
    this.witchActions = new Map() // 女巫行动记录 witchId -> {action, target, timestamp}
    this.currentSubPhase = null // 当前子阶段 ('save' | 'poison' | null)
    this.savePhaseCompleted = false // 解药阶段是否完成
    this.poisonPhaseCompleted = false // 毒药阶段是否完成
    this.availableVictims = [] // 可救活的受害者列表
    this.subPhaseTimeout = null // 子阶段超时定时器

    // 子阶段时间配置
    this.savePhaseTime = this.phaseConfig.subPhases.SAVE_PHASE.timeout || 30000
    this.poisonPhaseTime = this.phaseConfig.subPhases.POISON_PHASE.timeout || 30000
  }

  /**
   * 启动阶段逻辑
   * 干预阶段采用顺序执行：先解药阶段，后毒药阶段
   */
  async startPhaseLogic () {
    try {
      // 检查是否有女巫存活
      const witchPlayers = this.game.getAlivePlayers({ roleType: 'WitchRole', includeRole: true })
      if (witchPlayers.length === 0) {
        console.log('[InterventionPhaseState] 没有存活的女巫，跳过干预阶段')
        await this.completePhase()
        return
      }

      // 获取可救活的受害者（被狼人杀死的玩家）
      this.availableVictims = this.getAvailableVictims()

      // 启动解药阶段
      await this.startSavePhase()
    } catch (error) {
      console.error('[InterventionPhaseState] 启动阶段逻辑失败:', error)
      // 替换emit调用为notificationCenter
      await this.game.notificationCenter.handleError(new GameError(
        '启动干预阶段失败',
        'INTERVENTION_START_ERROR',
        { error }
      ))
    }
  }

  /**
   * 启动解药阶段
   */
  async startSavePhase () {
    this.currentSubPhase = 'save'
    this.savePhaseCompleted = false

    try {
      // 通知解药阶段开始
      await this.notifySubPhaseStart('save')

      // 设置子阶段超时
      this.subPhaseTimeout = setTimeout(async () => {
        await this.onSubPhaseTimeout('save')
      }, this.savePhaseTime)

      console.log('[InterventionPhaseState] 解药阶段开始')
    } catch (error) {
      console.error('[InterventionPhaseState] 启动解药阶段失败:', error)
    }
  }

  /**
   * 启动毒药阶段
   */
  async startPoisonPhase () {
    this.currentSubPhase = 'poison'
    this.poisonPhaseCompleted = false

    try {
      // 通知毒药阶段开始
      await this.notifySubPhaseStart('poison')

      // 设置子阶段超时
      this.subPhaseTimeout = setTimeout(async () => {
        await this.onSubPhaseTimeout('poison')
      }, this.poisonPhaseTime)

      console.log('[InterventionPhaseState] 毒药阶段开始')
    } catch (error) {
      console.error('[InterventionPhaseState] 启动毒药阶段失败:', error)
    }
  }

  /**
   * 执行具体的玩家行动逻辑
   * @param {Object} player - 玩家对象
   * @param {string} action - 行动类型
   * @param {*} data - 行动数据
   * @returns {Promise<*>} 行动结果
   */
  async executePlayerAction (player, action, data) {
    try {
      // 获取女巫角色实例
      const witchRole = this.game.getPlayerRole(player.id)
      if (!witchRole || witchRole.constructor.name !== 'WitchRole') {
        throw new GameError('只有女巫可以在干预阶段行动', 'INVALID_ROLE')
      }

      let result = null

      switch (action) {
        case ACTIONS.SAVE:
          result = await this.handleSaveAction(player, witchRole, data)
          break
        case ACTIONS.POISON:
          result = await this.handlePoisonAction(player, witchRole, data)
          break
        case ACTIONS.SKIP:
          result = await this.handleSkipAction(player, witchRole)
          break
        default:
          throw new GameError(`无效的行动类型: ${action}`, 'INVALID_ACTION')
      }

      // 记录女巫行动
      this.witchActions.set(player.id, {
        action,
        data,
        result,
        timestamp: Date.now(),
        subPhase: this.currentSubPhase
      })

      // 检查子阶段是否完成
      await this.checkSubPhaseCompletion()

      return result
    } catch (error) {
      console.error('[InterventionPhaseState] 执行玩家行动失败:', error)
      throw error
    }
  }

  /**
   * 处理解药行动
   */
  async handleSaveAction (player, witchRole, data) {
    // 验证当前是否为解药阶段
    if (this.currentSubPhase !== 'save') {
      throw new GameError('当前不是解药使用阶段', 'INVALID_PHASE')
    }

    // 验证女巫是否有解药
    if (!witchRole.hasAntidote) {
      throw new GameError('女巫已经没有解药了', 'NO_ANTIDOTE')
    }

    // 获取要救活的目标（通常是被狼人杀死的玩家）
    let target = null
    if (this.availableVictims.length > 0) {
      target = this.availableVictims[0] // 通常只有一个受害者
    }

    if (!target) {
      throw new GameError('今晚没有人被狼人杀死，无法使用解药', 'NO_VICTIM_TO_SAVE')
    }

    // 检查是否能自救
    if (target.id === player.id && !witchRole.canSaveSelf) {
      throw new GameError('女巫不能对自己使用解药', 'CANNOT_SAVE_SELF')
    }

    // 执行救人行动
    const result = await witchRole.act(target, 'save')

    if (result) {
      await this.notifyActionResult(player, 'save', target)
      this.savePhaseCompleted = true
    }

    return result
  }

  /**
   * 处理毒药行动
   */
  async handlePoisonAction (player, witchRole, data) {
    // 验证当前是否为毒药阶段
    if (this.currentSubPhase !== 'poison') {
      throw new GameError('当前不是毒药使用阶段', 'INVALID_PHASE')
    }

    // 验证女巫是否有毒药
    if (!witchRole.hasPoison) {
      throw new GameError('女巫已经没有毒药了', 'NO_POISON')
    }

    // 获取毒杀目标
    const targetId = data
    if (!targetId) {
      throw new GameError('必须指定毒杀目标', 'NO_TARGET')
    }

    const target = this.game.playerManager.getPlayerById(targetId)
    if (!target) {
      throw new GameError('目标玩家不存在', 'INVALID_TARGET')
    }

    // 执行毒杀行动
    const result = await witchRole.act(target, 'poison')

    if (result) {
      await this.notifyActionResult(player, 'poison', target)
      this.poisonPhaseCompleted = true
    }

    return result
  }

  /**
   * 处理跳过行动
   */
  async handleSkipAction (player, witchRole) {
    // 根据当前子阶段标记相应阶段完成
    if (this.currentSubPhase === 'save') {
      this.savePhaseCompleted = true
      await this.notifyActionResult(player, 'skip_save', null)
    } else if (this.currentSubPhase === 'poison') {
      this.poisonPhaseCompleted = true
      await this.notifyActionResult(player, 'skip_poison', null)
    }

    return true
  }

  /**
   * 验证特定行动的有效性
   * @param {Object} player - 玩家对象
   * @param {string} action - 行动类型
   * @returns {boolean} 是否有效
   */
  validateSpecificAction (player, action) {
    try {
      // 获取女巫角色实例
      const witchRole = this.game.playerManager.roles.get(player.id)
      if (!witchRole || witchRole.constructor.name !== 'WitchRole') {
        return false
      }

      // 根据当前子阶段验证行动
      if (this.currentSubPhase === 'save') {
        return action === ACTIONS.SAVE || action === ACTIONS.SKIP
      } else if (this.currentSubPhase === 'poison') {
        return action === ACTIONS.POISON || action === ACTIONS.SKIP
      }

      return false
    } catch (error) {
      console.error('[InterventionPhaseState] 验证行动时发生错误:', error)
      return false
    }
  }

  /**
   * 处理超时行动
   */
  async handleTimeoutActions () {
    try {
      const witchPlayers = this.game.getAlivePlayers({ roleType: 'WitchRole', includeRole: true })

      for (const { player } of witchPlayers) {
        if (!this.completedActions.has(player.id)) {
          // 为未行动的女巫设置跳过行动
          await this.handleSkipAction(player, this.game.playerManager.roles.get(player.id))

          this.completedActions.set(player.id, {
            player,
            action: ACTIONS.SKIP,
            data: null,
            result: true,
            timestamp: Date.now(),
            isTimeout: true
          })
        }
      }
    } catch (error) {
      console.error('[InterventionPhaseState] 处理超时行动失败:', error)
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取可救活的受害者列表
   * @returns {Array} 被狼人杀死的玩家列表
   */
  getAvailableVictims () {
    const victims = []

    // 查找被狼人杀死的玩家
    for (const player of this.game.playerManager.getAllPlayers().values()) {
      if (!player.isAlive && player.deathReason === 'WOLF_KILL') {
        victims.push(player)
      }
    }

    return victims
  }

  /**
   * 通知子阶段开始
   * @param {string} subPhase - 子阶段名称 ('save' | 'poison')
   */
  async notifySubPhaseStart (subPhase) {
    try {
      const witchPlayers = this.game.getAlivePlayers({ roleType: 'WitchRole', includeRole: true })

      for (const { player } of witchPlayers) {
        let message = ''

        if (subPhase === 'save') {
          if (this.availableVictims.length > 0) {
            const victim = this.availableVictims[0]
            message = `【女巫-解药阶段】今晚 ${victim.name} 被狼人杀死，你可以选择：\n1. #救人 - 使用解药救活\n2. #跳过 - 不使用解药`
          } else {
            message = '【女巫-解药阶段】今晚没有人被狼人杀死，无法使用解药\n输入 #跳过 继续'
          }
        } else if (subPhase === 'poison') {
          const alivePlayersList = this.getAlivePlayersList(player)
          message = `【女巫-毒药阶段】请选择毒杀目标：\n${alivePlayersList.join('\n')}\n输入格式：#毒杀*号\n或输入 #跳过 不使用毒药`
        }

        await this.sendPrivateMessage(player, message)
      }
    } catch (error) {
      console.error('[InterventionPhaseState] 通知子阶段开始失败:', error)
    }
  }

  /**
   * 通知行动结果
   * @param {Object} player - 玩家对象
   * @param {string} action - 行动类型
   * @param {Object} target - 目标玩家
   */
  async notifyActionResult (player, action, target) {
    try {
      let message = ''

      switch (action) {
        case 'save':
          message = `你使用解药救活了 ${target.name}`
          break
        case 'poison':
          message = `你使用毒药毒杀了 ${target.name}`
          break
        case 'skip_save':
          message = '你选择不使用解药'
          break
        case 'skip_poison':
          message = '你选择不使用毒药'
          break
      }

      await this.sendPrivateMessage(player, message)
    } catch (error) {
      console.error('[InterventionPhaseState] 通知行动结果失败:', error)
    }
  }

  /**
   * 发送私聊消息
   * @param {Object} player - 玩家对象
   * @param {string} message - 消息内容
   */
  async sendPrivateMessage (player, message) {
    try {
      // 替换emit调用为notificationCenter
      await this.game.notificationCenter.sendPrivateMessage(player.id, message)
    } catch (error) {
      console.error('[InterventionPhaseState] 发送私聊消息失败:', error)
    }
  }

  /**
   * 获取存活玩家列表（排除指定玩家）
   * @param {Object} excludePlayer - 要排除的玩家
   * @returns {Array} 格式化的玩家列表
   */
  getAlivePlayersList (excludePlayer = null) {
    const alivePlayers = []
    let index = 1

    for (const player of this.game.playerManager.getAllPlayers().values()) {
      if (player.isAlive && (!excludePlayer || player.id !== excludePlayer.id)) {
        alivePlayers.push(`${index}. ${player.name}`)
        index++
      }
    }

    return alivePlayers
  }

  /**
   * 检查子阶段是否完成
   */
  async checkSubPhaseCompletion () {
    try {
      if (this.currentSubPhase === 'save' && this.savePhaseCompleted) {
        // 解药阶段完成，清理超时定时器
        if (this.subPhaseTimeout) {
          clearTimeout(this.subPhaseTimeout)
          this.subPhaseTimeout = null
        }

        // 启动毒药阶段
        await this.startPoisonPhase()
      } else if (this.currentSubPhase === 'poison' && this.poisonPhaseCompleted) {
        // 毒药阶段完成，清理超时定时器
        if (this.subPhaseTimeout) {
          clearTimeout(this.subPhaseTimeout)
          this.subPhaseTimeout = null
        }

        // 完成整个干预阶段
        await this.completePhase()
      }
    } catch (error) {
      console.error('[InterventionPhaseState] 检查子阶段完成状态失败:', error)
    }
  }

  /**
   * 子阶段超时处理
   * @param {string} subPhase - 超时的子阶段
   */
  async onSubPhaseTimeout (subPhase) {
    try {
      console.log(`[InterventionPhaseState] ${subPhase}阶段超时`)

      // 为未行动的女巫设置默认跳过行动
      const witchPlayers = this.game.getAlivePlayers({ roleType: 'WitchRole', includeRole: true })

      for (const { player } of witchPlayers) {
        if (!this.witchActions.has(player.id) ||
            this.witchActions.get(player.id).subPhase !== subPhase) {
          const witchRole = this.game.playerManager.roles.get(player.id)
          await this.handleSkipAction(player, witchRole)

          await this.sendPrivateMessage(player, `${subPhase}阶段超时，自动跳过`)
        }
      }

      // 标记相应阶段完成
      if (subPhase === 'save') {
        this.savePhaseCompleted = true
      } else if (subPhase === 'poison') {
        this.poisonPhaseCompleted = true
      }

      // 检查是否需要进入下一阶段
      await this.checkSubPhaseCompletion()
    } catch (error) {
      console.error('[InterventionPhaseState] 处理子阶段超时失败:', error)
    }
  }

  /**
   * 阶段完成时的处理逻辑
   */
  async onPhaseComplete () {
    try {
      // 清理子阶段超时定时器
      if (this.subPhaseTimeout) {
        clearTimeout(this.subPhaseTimeout)
        this.subPhaseTimeout = null
      }

      console.log('[InterventionPhaseState] 干预阶段完成')

      // 通知阶段完成
      await this.game.e.reply('🌙 女巫行动完成')
    } catch (error) {
      console.error('[InterventionPhaseState] 阶段完成处理失败:', error)
    }
  }

  /**
   * 清理阶段资源
   */
  async cleanupPhase () {
    try {
      // 清理子阶段超时定时器
      if (this.subPhaseTimeout) {
        clearTimeout(this.subPhaseTimeout)
        this.subPhaseTimeout = null
      }

      // 清理女巫行动记录
      this.witchActions.clear()

      // 重置阶段状态
      this.currentSubPhase = null
      this.savePhaseCompleted = false
      this.poisonPhaseCompleted = false
      this.availableVictims = []

      // 调用父类清理方法
      await super.cleanupPhase()
    } catch (error) {
      console.error('[InterventionPhaseState] 清理阶段资源失败:', error)
    }
  }
}
