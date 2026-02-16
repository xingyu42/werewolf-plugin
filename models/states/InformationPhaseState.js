/**
 * @file InformationPhaseState.js
 * @description 信息收集阶段状态类，处理预言家查验和守卫保护
 * @module model/strategies/states/InformationPhaseState
 *
 * @input NightPhaseState, GameError, NIGHT_PHASE_CONFIG, ACTIONS
 * @output InformationPhaseState - 信息收集阶段类
 * @pos 策略层 - 夜晚第一阶段，预言家和守卫并行行动
 *
 * @dependencies
 * - ./NightPhaseState.js - 夜晚阶段基类
 * - ../../core/GameError.js - 游戏错误
 * - ../../core/Constants.js - 阶段配置和行动常量
 */
import { NightPhaseState } from './NightPhaseState.js'
import { GameError } from '../../utils/GameError.js'
import { NIGHT_PHASE_CONFIG, ACTIONS, toRoleClassName } from '../Constants.js'

export class InformationPhaseState extends NightPhaseState {
  constructor (game) {
    // 使用信息收集阶段的配置
    super(game, NIGHT_PHASE_CONFIG.INFORMATION)

    // 信息收集阶段特有属性
    this.prophetResults = new Map() // 预言家查验结果 playerId -> result
    this.guardProtections = new Map() // 守卫保护记录 playerId -> targetId
    this.roleNotificationSent = new Set() // 已发送通知的角色类型
  }

  /**
   * 启动阶段逻辑 - 并行通知预言家和守卫
   */
  async startPhaseLogic () {
    try {
      console.log('[InformationPhaseState] 启动信息收集阶段逻辑')

      // 并行通知所有活跃角色
      const notificationPromises = []

      for (const role of this.activeRoles) {
        const roleType = toRoleClassName(role)
        const notificationPromise = this.notifyRoleAction(roleType)
        notificationPromises.push(notificationPromise)
      }

      // 等待所有通知发送完成
      await Promise.allSettled(notificationPromises)

      console.log('[InformationPhaseState] 所有角色通知已发送')
    } catch (error) {
      console.error('[InformationPhaseState] 启动阶段逻辑失败:', error)
      throw error
    }
  }

  /**
   * 通知特定角色行动
   * @param {string} roleType - 角色类型（如 'ProphetRole', 'GuardRole'）
   */
  async notifyRoleAction (roleType) {
    try {
      if (this.roleNotificationSent.has(roleType)) {
        return // 避免重复通知
      }

      // 获取该角色类型的存活玩家
      const rolePlayers = this.game.getAlivePlayers({ roleType, includeRole: true })
      if (!rolePlayers || rolePlayers.length === 0) {
        console.log(`[InformationPhaseState] 没有 ${roleType} 类型的存活玩家`)
        return
      }

      // 通知角色行动
      for (const { player, role } of rolePlayers) {
        try {
          if (role && typeof role.getActionPrompt === 'function') {
            // 角色内部通过 sendPrivate 发送私聊消息，await 确保完成
            await role.getActionPrompt()
          }
        } catch (error) {
          console.warn(`[InformationPhaseState] 向 ${roleType} 玩家 ${player.id} 发送行动提示失败:`, error.message)
        }
      }
      this.roleNotificationSent.add(roleType)

      console.log(`[InformationPhaseState] ${roleType} 行动通知发送成功`)
    } catch (error) {
      console.error(`[InformationPhaseState] 通知 ${roleType} 行动失败:`, error)
    }
  }

  /**
   * 执行具体的玩家行动逻辑
   * @param {Object} player - 玩家对象
   * @param {string} action - 行动类型
   * @param {*} data - 行动数据（通常是目标玩家ID）
   * @returns {Promise<*>} 行动结果
   */
  async executePlayerAction (player, action, data) {
    try {
      // 获取玩家角色
      const role = this.game.getPlayerRole(player.id)
      if (!role) {
        throw new GameError('玩家角色不存在', 'ROLE_NOT_FOUND', { playerId: player.id })
      }

      const roleType = role.constructor.name
      console.log(`[InformationPhaseState] 执行 ${roleType} 玩家 ${player.id} 的 ${action} 行动`)

      let result = null

      // 根据行动类型处理
      switch (action) {
        case ACTIONS.CHECK:
          result = await this.handleProphetCheck(player, role, data)
          break
        case ACTIONS.PROTECT:
          result = await this.handleGuardProtect(player, role, data)
          break
        case ACTIONS.SKIP:
          result = await this.handleSkipAction(player, role)
          break
        default:
          throw new GameError(`不支持的行动类型: ${action}`, 'UNSUPPORTED_ACTION', { action })
      }

      // 检查阶段是否完成
      await this.checkPhaseCompletion()

      return result
    } catch (error) {
      console.error('[InformationPhaseState] 执行玩家行动失败:', error)
      throw error
    }
  }

  /**
   * 处理预言家查验行动
   * @param {Object} player - 预言家玩家
   * @param {Object} role - 预言家角色实例
   * @param {string} targetId - 查验目标ID
   * @returns {Promise<string>} 查验结果
   */
  async handleProphetCheck (player, role, targetId) {
    try {
      // 获取目标玩家
      const target = this.game.getPlayerById(targetId)
      if (!target) {
        throw new GameError('查验目标不存在', 'TARGET_NOT_FOUND', { targetId })
      }

      // 执行角色的查验行动
      const result = await role.act(target, 'check')

      if (result) {
        // 记录查验结果
        this.prophetResults.set(player.id, {
          targetId,
          targetName: target.name,
          result,
          timestamp: Date.now()
        })

        console.log(`[InformationPhaseState] 预言家 ${player.id} 查验了 ${targetId}`)
      }

      return result
    } catch (error) {
      console.error('[InformationPhaseState] 处理预言家查验失败:', error)
      throw error
    }
  }

  /**
   * 处理守卫保护行动
   * @param {Object} player - 守卫玩家
   * @param {Object} role - 守卫角色实例
   * @param {string} targetId - 保护目标ID
   * @returns {Promise<boolean>} 保护是否成功
   */
  async handleGuardProtect (player, role, targetId) {
    try {
      // 获取目标玩家
      const target = this.game.getPlayerById(targetId)
      if (!target) {
        throw new GameError('保护目标不存在', 'TARGET_NOT_FOUND', { targetId })
      }

      // 执行角色的保护行动
      const result = await role.act(target, 'protect')

      if (result) {
        // 记录保护信息
        this.guardProtections.set(player.id, {
          targetId,
          targetName: target.name,
          timestamp: Date.now()
        })

        console.log(`[InformationPhaseState] 守卫 ${player.id} 保护了 ${targetId}`)
      }

      return result
    } catch (error) {
      console.error('[InformationPhaseState] 处理守卫保护失败:', error)
      throw error
    }
  }

  /**
   * 处理跳过行动
   * @param {Object} player - 玩家对象
   * @param {Object} role - 角色实例
   * @returns {Promise<boolean>} 跳过是否成功
   */
  async handleSkipAction (player, role) {
    try {
      const roleType = role.constructor.name
      console.log(`[InformationPhaseState] ${roleType} 玩家 ${player.id} 选择跳过行动`)

      // 发送跳过确认消息
      await role.sendPrivate('你选择了跳过本回合的行动')

      return true
    } catch (error) {
      console.error('[InformationPhaseState] 处理跳过行动失败:', error)
      throw error
    }
  }

  /**
   * 验证特定行动的有效性
   * @param {Object} player - 玩家对象
   * @param {string} action - 行动类型
   * @returns {boolean} 是否有效
   */
  validateSpecificAction (player, action) {
    try {
      // 获取玩家角色
      const role = this.game.getPlayerRole(player.id)
      if (!role) {
        return false
      }

      const roleType = role.constructor.name

      // 验证角色是否可以在当前状态下行动
      if (!role.canAct(this)) {
        return false
      }

      // 根据角色类型验证特定行动
      switch (roleType) {
        case 'ProphetRole':
          return action === ACTIONS.CHECK || action === ACTIONS.SKIP
        case 'GuardRole':
          return action === ACTIONS.PROTECT || action === ACTIONS.SKIP
        default:
          return false
      }
    } catch (error) {
      console.error('[InformationPhaseState] 验证特定行动失败:', error)
      return false
    }
  }

  /**
   * 处理超时行动 - 为未行动的玩家设置默认行动
   */
  async handleTimeoutActions () {
    try {
      console.log('[InformationPhaseState] 处理信息收集阶段超时')

      // 为每个活跃角色的未行动玩家设置默认行动
      for (const role of this.activeRoles) {
        const roleType = toRoleClassName(role)
        const rolePlayers = this.game.getAlivePlayers({ roleType, includeRole: true })

        for (const { player } of rolePlayers) {
          if (!this.completedActions.has(player.id)) {
            // 设置默认跳过行动
            this.completedActions.set(player.id, {
              player,
              action: ACTIONS.SKIP,
              data: null,
              result: true,
              timestamp: Date.now(),
              isTimeout: true
            })

            console.log(`[InformationPhaseState] 为 ${roleType} 玩家 ${player.id} 设置默认跳过行动`)
          }
        }
      }
    } catch (error) {
      console.error('[InformationPhaseState] 处理超时行动失败:', error)
    }
  }

  /**
   * 阶段完成时的处理逻辑
   */
  async onPhaseComplete () {
    try {
      console.log('[InformationPhaseState] 信息收集阶段完成')

      // 输出阶段统计信息
      const stats = this.getPhaseStats()
      console.log('[InformationPhaseState] 阶段统计:', {
        预言家查验数: this.prophetResults.size,
        守卫保护数: this.guardProtections.size,
        完成行动数: stats.completedActions,
        阶段耗时: stats.duration
      })

      // 这里只需要输出日志，父类会处理回调机制
    } catch (error) {
      console.error('[InformationPhaseState] 阶段完成处理失败:', error)
      throw error // 抛出错误让父类处理
    }
  }

  /**
   * 清理阶段资源
   */
  async cleanupPhase () {
    try {
      // 清理阶段特有的数据
      this.prophetResults.clear()
      this.guardProtections.clear()
      this.roleNotificationSent.clear()

      // 调用父类清理方法
      await super.cleanupPhase()

      console.log('[InformationPhaseState] 信息收集阶段资源清理完成')
    } catch (error) {
      console.error('[InformationPhaseState] 清理阶段资源失败:', error)
    }
  }

  /**
   * 获取阶段特定的统计信息
   */
  getPhaseStats () {
    const baseStats = super.getPhaseStats()

    return {
      ...baseStats,
      prophetChecks: this.prophetResults.size,
      guardProtections: this.guardProtections.size,
      roleNotificationsSent: this.roleNotificationSent.size,
      prophetResults: Array.from(this.prophetResults.values()),
      guardProtectionTargets: Array.from(this.guardProtections.values())
    }
  }
}
