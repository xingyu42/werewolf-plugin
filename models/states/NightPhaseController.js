/**
 * @file NightPhaseController.js
 * @description 夜晚阶段控制器，协调三个夜晚子阶段的顺序执行
 * @module model/strategies/states/NightPhaseController
 *
 * @input GameState, DayState, PhaseManager, PhaseCoordinator, GameError
 * @output NightPhaseController - 夜晚控制器类
 * @pos 策略层 - 夜晚流程控制，替代 NightState
 *
 * @dependencies
 * - ./GameState.js - 状态基类
 * - ./DayState.js - 白天状态（转换目标）
 * - ../../managers/PhaseManager.js - 阶段管理器
 * - ../../core/PhaseCoordinator.js - 阶段协调器
 * - ../../core/GameError.js - 游戏错误
 */
import { GameState } from './GameState.js'
import { DayState } from './DayState.js'
import { PhaseManager } from '../PhaseManager.js'
import { PhaseCoordinator } from '../PhaseCoordinator.js'
import { GameError } from '../../utils/GameError.js'

export class NightPhaseController extends GameState {
  constructor (game) {
    super(game)

    // 阶段协调器和管理器
    this.phaseCoordinator = new PhaseCoordinator(this)
    this.phaseManager = new PhaseManager(game, this.phaseCoordinator)

    // 夜晚流程状态
    this.isNightStarted = false
    this.isNightCompleted = false
    this.nightStartTime = null

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
   * 进入夜晚状态
   */
  async onEnter () {
    await super.onEnter()

    try {
      this.nightStartTime = Date.now()
      this.isNightStarted = true
      this.isNightCompleted = false

      // 发送夜晚开始通知（保持与NightState一致）
      await this.notifyNightStart()

      // 移除：this.setupPhaseManagerListeners()
      // 改为：PhaseCoordinator已在构造函数中创建并传递给PhaseManager

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
      // 移除：this.cleanupPhaseManagerListeners()

      // 清理阶段管理器
      if (this.phaseManager) {
        await this.phaseManager.cleanup()
      }

      // 清理阶段协调器
      if (this.phaseCoordinator) {
        this.phaseCoordinator.cleanup()
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

  // ==================== 夜晚流程控制方法 ====================

  /**
   * 发送夜晚开始通知
   */
  async notifyNightStart () {
    try {
      await this.game.e.reply('🌙 夜晚降临，请查看私聊消息')
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
   * 转换到白天状态
   */
  async transitionToDay () {
    try {
      console.log('[NightPhaseController] 转换到白天状态')

      // 每个夜晚结束后都应转换到白天
      this.game._dayStartPending = true
      this.game._dayStartDeathsAnnounced = false
      await this.game.changeState(new DayState(this.game))
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
      for (const player of this.game.getAllPlayers().values()) {
        player.protected = false
      }

      console.log('[NightPhaseController] 玩家状态清理完成')
    } catch (error) {
      console.error('[NightPhaseController] 清理玩家状态失败:', error)
    }
  }

  // ==================== 阶段协调处理 ====================
  // 移除了所有事件监听器方法，逻辑已迁移到PhaseCoordinator

  /**
   * 处理夜晚阶段完成 - 由completeAllPhases结果触发
   */
  async handleNightPhasesCompleted (shouldTransitionToDay = true) {
    try {
      console.log('[NightPhaseController] 夜晚阶段完成，准备转换到白天')

      if (shouldTransitionToDay) {
        // 完成夜晚流程
        await this.completeNight()
      }
    } catch (error) {
      console.error('[NightPhaseController] 处理夜晚阶段完成失败:', error)
      throw error
    }
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
      currentPhase: this.getCurrentPhaseState()?.phaseConfig?.name || null
    }
  }
}
