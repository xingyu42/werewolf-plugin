/**
 * 夜晚阶段控制器
 * 继承自GameState，替代现有的NightState，使用PhaseManager协调三个阶段的顺序执行
 * 实现完整的夜晚流程控制逻辑，保持与现有NightState相同的外部接口
 *
 * {{CHENGQI: Action: Added; Timestamp: 2025-06-19 20:35:00 +08:00; Reason: Shrimp Task ID: #50bcc8eb-d419-4717-b567-37f630d3ecc7, 创建阶段化夜晚状态控制器; Principle_Applied: SOLID-SRP-SingleResponsibility-DIP-DependencyInversion;}}
 */

import { GameState } from './GameState.js'
import { DayState } from './DayState.js'
import { PhaseManager } from '../managers/PhaseManager.js'
import { SimpleStateNotifier } from '../adapters/SimpleStateNotifier.js'
import { GameError } from '../core/GameError.js'

export class NightPhaseController extends GameState {
  constructor (game) {
    super(game)

    // 阶段管理器
    this.phaseManager = new PhaseManager(game)

    // 夜晚流程状态
    this.isNightStarted = false
    this.isNightCompleted = false
    this.nightStartTime = null

    // 兼容性属性（保持与NightState接口一致）
    this.actionQueue = [] // 空队列，保持接口兼容
    this.currentActionRole = null // 当前行动角色（由阶段状态管理）
    this.actionLock = false // 状态锁（由阶段状态管理）
    this.completedRoles = new Set() // 已完成行动的角色
    this.roleActions = new Map() // 记录各角色行动
    this.wolfVotes = new Map() // 狼人投票记录

    // 错误恢复
    this.maxRetries = 3
    this.retryCount = 0

    console.log('[NightPhaseController] 夜晚阶段控制器初始化完成')
  }

  /**
   * 获取状态名称 - 重写父类方法以保持向后兼容性
   * 返回 'NightState' 确保角色状态检查正常工作
   *
   * {{CHENGQI: Action: Added; Timestamp: 2025-06-21 13:30:47 +08:00; Reason: Shrimp Task ID: #5a013433-aae3-4e8a-8a00-c8c25453c895, 添加getName重写保持角色兼容性; Principle_Applied: SOLID-LSP-LiskovSubstitution;}}
   */
  getName () {
    return 'NightState' // 保持与角色检查兼容
  }

  /**
   * 获取内部类名 - 用于调试和日志记录
   */
  getInternalName () {
    return this.constructor.name // 'NightPhaseController'
  }

  /**
   * 进入夜晚状态
   */
  async onEnter () {
    await super.onEnter()

    try {
      this.nightStartTime = Date.now()
      this.isNightStarted = true
      this.isNightCompleted = false
      this.retryCount = 0

      // 清理状态
      this.completedRoles.clear()
      this.roleActions.clear()
      this.wolfVotes.clear()

      // 发送夜晚开始通知（保持与NightState一致）
      await this.notifyNightStart()

      // 设置阶段管理器事件监听
      this.setupPhaseManagerListeners()

      // 启动阶段流程
      await this.startNightPhases()

      console.log('[NightPhaseController] 夜晚阶段控制器启动成功')
    } catch (error) {
      console.error('[NightPhaseController] 进入夜晚状态失败:', error)
      await this.handleNightError(error, 'onEnter')
    }
  }

  /**
   * 退出夜晚状态
   */
  async onExit () {
    try {
      // 清理阶段管理器事件监听
      this.cleanupPhaseManagerListeners()

      // 清理阶段管理器
      if (this.phaseManager) {
        await this.phaseManager.cleanup()
      }

      // 清理保护状态（保持与NightState一致）
      await this.cleanupPlayerStates()

      console.log('[NightPhaseController] 夜晚阶段控制器退出完成')
    } catch (error) {
      console.error('[NightPhaseController] 退出夜晚状态失败:', error)
    } finally {
      await super.onExit()
    }
  }

  /**
   * 处理玩家行动
   * @param {Object} player - 玩家对象
   * @param {string} action - 行动类型
   * @param {*} data - 行动数据
   */
  async handleAction (player, action, data) {
    try {
      // 检查夜晚是否已开始
      if (!this.isNightStarted) {
        throw new GameError('夜晚阶段尚未开始', 'NIGHT_NOT_STARTED')
      }

      // 检查夜晚是否已完成
      if (this.isNightCompleted) {
        throw new GameError('夜晚阶段已完成', 'NIGHT_COMPLETED')
      }

      // 获取当前阶段状态
      const currentPhaseState = this.phaseManager.getCurrentPhaseState()
      if (!currentPhaseState) {
        throw new GameError('没有活跃的阶段状态', 'NO_ACTIVE_PHASE')
      }

      // 委派给当前阶段状态处理
      await currentPhaseState.handleAction(player, action, data)

      // 记录行动（保持与NightState兼容）
      this.recordPlayerAction(player, action, data)
    } catch (error) {
      console.error('[NightPhaseController] 处理玩家行动失败:', error)
      throw error
    }
  }

  /**
   * 检查行动是否有效
   * @param {Object} player - 玩家对象
   * @param {string} action - 行动类型
   * @returns {boolean} 是否有效
   */
  isValidAction (player, action) {
    try {
      // 基础检查
      if (!this.isNightStarted || this.isNightCompleted) {
        return false
      }

      // 获取当前阶段状态
      const currentPhaseState = this.phaseManager.getCurrentPhaseState()
      if (!currentPhaseState) {
        return false
      }

      // 委派给当前阶段状态验证
      return currentPhaseState.isValidAction(player, action)
    } catch (error) {
      console.error('[NightPhaseController] 验证行动有效性失败:', error)
      return false
    }
  }

  /**
   * 超时处理
   */
  async onTimeout () {
    try {
      console.log('[NightPhaseController] 夜晚阶段超时')

      // 获取当前阶段状态
      const currentPhaseState = this.phaseManager.getCurrentPhaseState()
      if (currentPhaseState && typeof currentPhaseState.onTimeout === 'function') {
        await currentPhaseState.onTimeout()
      } else {
        // 如果没有当前阶段状态，强制完成夜晚
        await this.forceCompleteNight()
      }
    } catch (error) {
      console.error('[NightPhaseController] 处理夜晚超时失败:', error)
      await this.handleNightError(error, 'onTimeout')
    }
  }

  // ==================== 夜晚流程控制方法 ====================

  /**
   * 发送夜晚开始通知
   */
  async notifyNightStart () {
    try {
      await SimpleStateNotifier.notifyNightStart(this.game, this.game.e)
      console.log('[NightPhaseController] 夜晚开始通知发送成功')
    } catch (error) {
      console.error('[NightPhaseController] 发送夜晚开始通知失败:', error)
    }
  }

  /**
   * 启动夜晚阶段流程
   */
  async startNightPhases () {
    try {
      console.log('[NightPhaseController] 启动夜晚阶段流程')

      // 启动第一个阶段（信息收集阶段）
      await this.phaseManager.startPhase(0)
    } catch (error) {
      console.error('[NightPhaseController] 启动夜晚阶段流程失败:', error)
      throw error
    }
  }

  /**
   * 完成夜晚流程
   */
  async completeNight () {
    try {
      if (this.isNightCompleted) {
        return
      }

      this.isNightCompleted = true
      console.log('[NightPhaseController] 夜晚流程完成')

      // 清理保护状态
      await this.cleanupPlayerStates()

      // 转换到白天状态
      await this.transitionToDay()
    } catch (error) {
      console.error('[NightPhaseController] 完成夜晚流程失败:', error)
      throw error
    }
  }

  /**
   * 强制完成夜晚（超时或错误时调用）
   */
  async forceCompleteNight () {
    try {
      console.log('[NightPhaseController] 强制完成夜晚流程')

      // 强制完成当前阶段
      if (this.phaseManager.getCurrentPhaseState()) {
        await this.phaseManager.forceCompleteCurrentPhase()
      }

      // 完成夜晚
      await this.completeNight()
    } catch (error) {
      console.error('[NightPhaseController] 强制完成夜晚失败:', error)
    }
  }

  /**
   * 转换到白天状态
   */
  async transitionToDay () {
    try {
      console.log('[NightPhaseController] 转换到白天状态')

      // 检查游戏回合（保持与NightState一致的逻辑）
      if (this.game.turn === 0) {
        await this.game.changeState(new DayState(this.game))
      }
    } catch (error) {
      console.error('[NightPhaseController] 转换到白天状态失败:', error)
      throw error
    }
  }

  /**
   * 清理玩家状态
   */
  async cleanupPlayerStates () {
    try {
      // 清理保护状态（保持与NightState一致）
      for (const player of this.game.playerManager.getAllPlayers().values()) {
        player.protected = false
      }

      console.log('[NightPhaseController] 玩家状态清理完成')
    } catch (error) {
      console.error('[NightPhaseController] 清理玩家状态失败:', error)
    }
  }

  // ==================== 阶段管理器事件处理 ====================

  /**
   * 设置阶段管理器事件监听
   */
  setupPhaseManagerListeners () {
    // 监听阶段开始事件
    this.phaseManager.on('phaseStarted', this.onPhaseStarted.bind(this))

    // 监听阶段完成事件
    this.phaseManager.on('phaseCompleted', this.onPhaseCompleted.bind(this))

    // 监听所有阶段完成事件
    this.phaseManager.on('allPhasesCompleted', this.onAllPhasesCompleted.bind(this))

    // 监听夜晚阶段完成事件
    this.phaseManager.on('nightPhasesCompleted', this.onNightPhasesCompleted.bind(this))

    // 监听阶段错误事件
    this.phaseManager.on('phaseError', this.onPhaseError.bind(this))
  }

  /**
   * 清理阶段管理器事件监听
   */
  cleanupPhaseManagerListeners () {
    if (this.phaseManager) {
      this.phaseManager.removeAllListeners()
    }
  }

  /**
   * 阶段开始事件处理
   * @param {Object} eventData - 事件数据
   */
  onPhaseStarted (eventData) {
    try {
      const { phaseName, phaseIndex } = eventData
      console.log(`[NightPhaseController] 阶段开始: ${phaseName} (索引: ${phaseIndex})`)

      // 更新当前行动角色（保持兼容性）
      this.updateCurrentActionRole(phaseName)

      // 发出阶段开始事件
      this.game.emit('phaseStarted', eventData)
    } catch (error) {
      console.error('[NightPhaseController] 处理阶段开始事件失败:', error)
    }
  }

  /**
   * 阶段完成事件处理
   * @param {Object} eventData - 事件数据
   */
  onPhaseCompleted (eventData) {
    try {
      const { phaseName, phaseIndex } = eventData
      console.log(`[NightPhaseController] 阶段完成: ${phaseName} (索引: ${phaseIndex})`)

      // 记录完成的角色（保持兼容性）
      this.recordCompletedPhase(phaseName)

      // 发出阶段完成事件
      this.game.emit('phaseCompleted', eventData)
    } catch (error) {
      console.error('[NightPhaseController] 处理阶段完成事件失败:', error)
    }
  }

  /**
   * 所有阶段完成事件处理
   * @param {Object} eventData - 事件数据
   */
  onAllPhasesCompleted (eventData) {
    try {
      console.log('[NightPhaseController] 所有阶段完成')

      // 发出所有阶段完成事件
      this.game.emit('allPhasesCompleted', eventData)
    } catch (error) {
      console.error('[NightPhaseController] 处理所有阶段完成事件失败:', error)
    }
  }

  /**
   * 夜晚阶段完成事件处理
   */
  onNightPhasesCompleted () {
    try {
      console.log('[NightPhaseController] 夜晚阶段完成，准备转换到白天')

      // 完成夜晚流程
      this.completeNight()
    } catch (error) {
      console.error('[NightPhaseController] 处理夜晚阶段完成事件失败:', error)
    }
  }

  /**
   * 阶段错误事件处理
   * @param {Object} errorData - 错误数据
   */
  onPhaseError (errorData) {
    try {
      console.error('[NightPhaseController] 阶段错误:', errorData)

      // 发出阶段错误事件
      this.game.emit('phaseError', errorData)

      // 尝试错误恢复
      this.handleNightError(errorData.error, 'phaseError')
    } catch (error) {
      console.error('[NightPhaseController] 处理阶段错误事件失败:', error)
    }
  }

  // ==================== 兼容性方法 ====================

  /**
   * 记录玩家行动（保持与NightState兼容）
   * @param {Object} player - 玩家对象
   * @param {string} action - 行动类型
   * @param {*} data - 行动数据
   */
  recordPlayerAction (player, action, data) {
    try {
      const role = this.game.playerManager.roles.get(player.id)
      const roleType = role ? role.constructor.name : 'Unknown'

      this.roleActions.set(player.id, {
        player,
        roleType,
        action,
        target: data,
        completed: true,
        timestamp: Date.now()
      })

      // 如果是狼人投票，也记录到wolfVotes
      if (roleType === 'WolfRole' && action === 'vote') {
        this.wolfVotes.set(player.id, {
          wolfId: player.id,
          targetId: data,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      console.error('[NightPhaseController] 记录玩家行动失败:', error)
    }
  }

  /**
   * 更新当前行动角色（保持兼容性）
   * @param {string} phaseName - 阶段名称
   */
  updateCurrentActionRole (phaseName) {
    try {
      // 根据阶段名称映射到角色类型
      switch (phaseName) {
        case 'information':
          this.currentActionRole = 'ProphetRole' // 信息收集阶段主要是预言家
          break
        case 'elimination':
          this.currentActionRole = 'WolfRole' // 消除阶段是狼人
          break
        case 'intervention':
          this.currentActionRole = 'WitchRole' // 干预阶段是女巫
          break
        default:
          this.currentActionRole = null
          break
      }
    } catch (error) {
      console.error('[NightPhaseController] 更新当前行动角色失败:', error)
    }
  }

  /**
   * 记录完成的阶段（保持兼容性）
   * @param {string} phaseName - 阶段名称
   */
  recordCompletedPhase (phaseName) {
    try {
      // 根据阶段名称添加到完成角色集合
      switch (phaseName) {
        case 'information':
          this.completedRoles.add('ProphetRole')
          this.completedRoles.add('GuardRole')
          break
        case 'elimination':
          this.completedRoles.add('WolfRole')
          break
        case 'intervention':
          this.completedRoles.add('WitchRole')
          break
      }
    } catch (error) {
      console.error('[NightPhaseController] 记录完成阶段失败:', error)
    }
  }

  // ==================== 错误处理和恢复 ====================

  /**
   * 处理夜晚错误
   * @param {Error} error - 错误对象
   * @param {string} context - 错误上下文
   */
  async handleNightError (error, context) {
    try {
      console.error(`[NightPhaseController] 夜晚错误 (${context}):`, error)

      this.retryCount++

      if (this.retryCount <= this.maxRetries) {
        console.log(`[NightPhaseController] 尝试错误恢复 (${this.retryCount}/${this.maxRetries})`)

        // 根据上下文进行不同的恢复策略
        switch (context) {
          case 'onEnter':
            // 重新启动夜晚流程
            await this.startNightPhases()
            break
          case 'phaseError':
            // 跳过当前阶段
            await this.phaseManager.skipCurrentPhase()
            break
          default:
            // 强制完成夜晚
            await this.forceCompleteNight()
            break
        }
      } else {
        console.error('[NightPhaseController] 错误恢复失败，强制完成夜晚')
        await this.forceCompleteNight()
      }
    } catch (recoveryError) {
      console.error('[NightPhaseController] 错误恢复过程中发生新错误:', recoveryError)

      // 发出严重错误事件
      this.game.emit('error', new GameError(
        '夜晚阶段控制器发生严重错误',
        'NIGHT_CONTROLLER_CRITICAL_ERROR',
        { originalError: error, recoveryError, context }
      ))
    }
  }

  // ==================== 兼容性接口方法 ====================

  /**
   * 开始下一个角色的行动（兼容性方法，实际由阶段管理器处理）
   */
  async startNextRoleAction () {
    // 此方法保持为空，实际逻辑由阶段管理器处理
    console.log('[NightPhaseController] startNextRoleAction 调用（由阶段管理器处理）')
  }

  /**
   * 通知特定角色的玩家行动（兼容性方法）
   * @param {string} roleType - 角色类型
   */
  async notifyRolePlayers (roleType) {
    // 此方法保持为空，实际逻辑由阶段状态处理
    console.log(`[NightPhaseController] notifyRolePlayers 调用: ${roleType}（由阶段状态处理）`)
  }

  /**
   * 通知玩家夜晚行动（兼容性方法）
   * @param {Object} player - 玩家对象
   * @param {Object} role - 角色对象
   */
  async notifyPlayer (player, role) {
    // 此方法保持为空，实际逻辑由阶段状态处理
    console.log(`[NightPhaseController] notifyPlayer 调用: ${player.id}（由阶段状态处理）`)
  }

  /**
   * 夜晚阶段结束（兼容性方法）
   */
  async finishNightPhase () {
    await this.completeNight()
  }

  // ==================== 获取状态信息方法 ====================

  /**
   * 获取当前阶段状态
   * @returns {Object|null} 当前阶段状态
   */
  getCurrentPhaseState () {
    return this.phaseManager ? this.phaseManager.getCurrentPhaseState() : null
  }

  /**
   * 获取阶段历史
   * @returns {Array} 阶段历史数组
   */
  getPhaseHistory () {
    return this.phaseManager ? this.phaseManager.getPhaseHistory() : []
  }

  /**
   * 获取夜晚统计信息
   * @returns {Object} 夜晚统计信息
   */
  getNightStats () {
    return {
      isStarted: this.isNightStarted,
      isCompleted: this.isNightCompleted,
      startTime: this.nightStartTime,
      currentPhase: this.getCurrentPhaseState()?.phaseConfig?.name || null,
      completedRoles: Array.from(this.completedRoles),
      actionCount: this.roleActions.size,
      retryCount: this.retryCount
    }
  }
}
