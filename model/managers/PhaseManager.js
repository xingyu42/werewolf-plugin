/**
 * 阶段管理器 - 负责夜晚阶段的转换逻辑、状态协调和流程控制
 * 管理阶段间的顺序执行，处理阶段完成条件检查，协调角色行动状态
 *
 * 职责分工：
 * - Game: 负责游戏级别状态转换 (NightState -> DayState)
 * - PhaseManager: 负责夜晚内部阶段转换 (信息收集 -> 消除 -> 干预)
 *
 * {{CHENGQI: Action: Added; Timestamp: 2025-06-19 19:51:05 +08:00; Reason: Shrimp Task ID: #30a79ac5-422c-45a8-b53a-1c5c5c6990f5, 创建阶段管理器; Principle_Applied: SOLID-SRP-SingleResponsibility-DIP-DependencyInversion;}}
 */

import { GameError } from '../core/GameError.js'
import { NIGHT_PHASE_ORDER } from '../core/Constants.js'
import { StateCallback } from '../core/StateCallback.js'

export class PhaseManager {
  constructor (game, phaseCoordinator) {
    // 移除 super() 调用

    // 基础属性
    this.game = game
    this.phaseCoordinator = phaseCoordinator
    this.stateCallback = new StateCallback(this)
    this.currentPhaseIndex = 0 // 当前阶段索引
    this.currentPhaseState = null // 当前阶段状态实例
    this.phaseHistory = [] // 阶段历史记录
    this.isTransitioning = false // 是否正在转换阶段

    // 阶段配置
    this.phaseOrder = [...NIGHT_PHASE_ORDER] // 阶段执行顺序
    this.phaseStates = new Map() // 阶段状态实例缓存

    // 错误恢复
    this.maxRetries = 3 // 最大重试次数
    this.retryCount = 0 // 当前重试次数

    // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:51:10 +08:00; Reason: Shrimp Task ID: #e18d361a-009f-4c79-896e-75ac0bb4b038, 完全移除Redis持久化相关属性; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
    // 移除了所有Redis持久化相关属性：persistenceEnabled, redis, persistenceKeyPrefix

    console.log('[PhaseManager] 阶段管理器初始化完成')
  }

  /**
   * 启动阶段流程
   * @param {number} startPhaseIndex - 起始阶段索引，默认从0开始
   */
  async startPhase (startPhaseIndex = 0) {
    try {
      if (this.isTransitioning) {
        console.warn('[PhaseManager] 阶段正在转换中，忽略启动请求')
        return
      }

      this.currentPhaseIndex = startPhaseIndex
      this.retryCount = 0

      // 验证阶段索引
      if (this.currentPhaseIndex >= this.phaseOrder.length) {
        console.log('[PhaseManager] 所有阶段已完成，准备结束夜晚')
        await this.completeAllPhases()
        return
      }

      const phaseConfig = this.phaseOrder[this.currentPhaseIndex]
      console.log(`[PhaseManager] 启动阶段: ${phaseConfig.name} (索引: ${this.currentPhaseIndex})`)

      // 创建阶段状态实例
      const phaseState = await this.createPhaseState(phaseConfig)
      if (!phaseState) {
        throw new GameError(`无法创建阶段状态: ${phaseConfig.name}`, 'PHASE_STATE_CREATION_FAILED')
      }

      this.currentPhaseState = phaseState

      // 记录阶段历史
      this.recordPhaseHistory('start', phaseConfig.name)

      // 替换事件监听为回调函数设置
      this.setupPhaseCallbacks(phaseState)

      // 启动阶段状态
      await this.game.changeState(phaseState)

      // 替换：this.emit('phaseStarted', {...})
      if (this.phaseCoordinator) {
        await this.phaseCoordinator.handlePhaseStarted(
          phaseConfig.name,
          this.currentPhaseIndex,
          { phaseConfig, startTime: Date.now() }
        )
      }

      // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:51:10 +08:00; Reason: Shrimp Task ID: #e18d361a-009f-4c79-896e-75ac0bb4b038, 移除保存阶段状态调用; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
      // 移除了保存阶段状态的调用
    } catch (error) {
      console.error('[PhaseManager] 启动阶段失败:', error)
      await this.handlePhaseError(error, 'start')
    }
  }

  /**
   * 完成当前阶段
   */
  async completePhase () {
    try {
      if (!this.currentPhaseState) {
        console.warn('[PhaseManager] 没有活跃的阶段状态')
        return
      }

      const phaseName = this.currentPhaseState.phaseConfig.name
      console.log(`[PhaseManager] 完成阶段: ${phaseName}`)

      // 记录阶段历史
      this.recordPhaseHistory('complete', phaseName)

      // 替换：this.emit('phaseCompleted', {...})
      if (this.phaseCoordinator) {
        await this.phaseCoordinator.handlePhaseCompleted(
          phaseName,
          this.currentPhaseIndex,
          { phaseStats: this.currentPhaseState.getPhaseStats() }
        )
      }

      // 转换到下一个阶段
      await this.transitionToNextPhase()
    } catch (error) {
      console.error('[PhaseManager] 完成阶段失败:', error)
      await this.handlePhaseError(error, 'complete')
    }
  }

  /**
   * 检查阶段完成条件
   */
  async checkPhaseCompletion () {
    try {
      if (!this.currentPhaseState || this.isTransitioning) {
        return false
      }

      // 委派给当前阶段状态检查
      const isCompleted = this.currentPhaseState.isPhaseCompleted

      if (isCompleted) {
        console.log(`[PhaseManager] 阶段完成条件满足: ${this.currentPhaseState.phaseConfig.name}`)
        await this.completePhase()
        return true
      }

      return false
    } catch (error) {
      console.error('[PhaseManager] 检查阶段完成条件失败:', error)
      return false
    }
  }

  /**
   * 转换到下一个阶段
   */
  async transitionToNextPhase () {
    try {
      if (this.isTransitioning) {
        console.warn('[PhaseManager] 阶段转换已在进行中')
        return
      }

      this.isTransitioning = true

      // 移除事件监听器清理：现在使用回调函数，无需清理事件监听器

      // 移动到下一个阶段
      this.currentPhaseIndex++

      // 检查是否还有更多阶段
      if (this.currentPhaseIndex >= this.phaseOrder.length) {
        console.log('[PhaseManager] 所有阶段已完成')
        await this.completeAllPhases()
        return
      }

      // 启动下一个阶段
      await this.startPhase(this.currentPhaseIndex)
    } catch (error) {
      console.error('[PhaseManager] 转换到下一阶段失败:', error)
      await this.handlePhaseError(error, 'transition')
    } finally {
      this.isTransitioning = false
    }
  }

  /**
   * 完成所有阶段
   */
  async completeAllPhases () {
    try {
      console.log('[PhaseManager] 夜晚所有阶段已完成')

      // 记录完成历史
      this.recordPhaseHistory('complete_all', 'all_phases')

      // 替换：this.emit('allPhasesCompleted', {...})
      // 替换：this.emit('nightPhasesCompleted')
      let result = { allCompleted: true }
      if (this.phaseCoordinator) {
        result = await this.phaseCoordinator.handleAllPhasesCompleted(
          this.phaseOrder.length,
          this.getPhaseHistory()
        )

        // 通知夜晚阶段完成并获取处理结果
        const nightResult = await this.phaseCoordinator.handleNightPhasesCompleted()
        if (nightResult.shouldTransitionToDay && this.phaseCoordinator.nightPhaseController) {
          // 直接调用NightPhaseController完成夜晚流程
          await this.phaseCoordinator.nightPhaseController.handleNightPhasesCompleted(true)
        }
      }

      // 清理阶段状态
      await this.cleanup()

      return result
    } catch (error) {
      console.error('[PhaseManager] 完成所有阶段失败:', error)
      // 替换：this.game.emit('error', new GameError(...))
      await this.game.notificationCenter.handleError(
        new GameError(
          '完成夜晚阶段失败',
          'NIGHT_PHASES_COMPLETION_ERROR',
          { error }
        )
      )
      throw error
    }
  }

  /**
   * 创建阶段状态实例
   * @param {Object} phaseConfig - 阶段配置
   * @returns {Promise<NightPhaseState>} 阶段状态实例
   */
  async createPhaseState (phaseConfig) {
    try {
      // 检查缓存
      const cacheKey = phaseConfig.name
      if (this.phaseStates.has(cacheKey)) {
        const cachedState = this.phaseStates.get(cacheKey)
        // 重置状态以便重用
        cachedState.isPhaseCompleted = false
        cachedState.completedActions.clear()
        return cachedState
      }

      // 动态导入对应的阶段状态类
      let PhaseStateClass
      switch (phaseConfig.name) {
        case 'information': {
          const { InformationPhaseState } = await import('../action/InformationPhaseState.js')
          PhaseStateClass = InformationPhaseState
          break
        }
        case 'elimination': {
          const { EliminationPhaseState } = await import('../action/EliminationPhaseState.js')
          PhaseStateClass = EliminationPhaseState
          break
        }
        case 'intervention': {
          const { InterventionPhaseState } = await import('../action/InterventionPhaseState.js')
          PhaseStateClass = InterventionPhaseState
          break
        }
        default:
          throw new GameError(`未知的阶段类型: ${phaseConfig.name}`, 'UNKNOWN_PHASE_TYPE')
      }

      // 创建实例
      const phaseState = new PhaseStateClass(this.game, phaseConfig)

      // 缓存实例
      this.phaseStates.set(cacheKey, phaseState)

      return phaseState
    } catch (error) {
      console.error(`[PhaseManager] 创建阶段状态失败: ${phaseConfig.name}`, error)
      return null
    }
  }

  /**
   * 设置阶段事件监听器
   * @param {NightPhaseState} phaseState - 阶段状态实例
   */
  setupPhaseCallbacks (phaseState) {
    // 替换事件监听为回调函数设置
    phaseState.setCompletionCallback(async (results) => {
      await this.handleStateCompletion(phaseState.phaseConfig.name, results)
      await this.transitionToNextPhase()
    })

    phaseState.setErrorCallback(async (error) => {
      await this.handleStateError(error, phaseState.phaseConfig.name)
    })
  }

  /**
   * 处理状态完成 - 新增方法供StateCallback调用
   * @param {string} stateName 状态名称
   * @param {Object} results 状态结果
   */
  async handleStateCompletion (stateName, results) {
    console.log(`[PhaseManager] 状态 ${stateName} 完成`, results)

    // 委托给PhaseCoordinator处理
    if (this.phaseCoordinator) {
      return await this.phaseCoordinator.handlePhaseCompleted(
        stateName,
        this.currentPhaseIndex,
        results
      )
    }

    return { handled: true }
  }

  /**
   * 处理状态错误 - 新增方法供StateCallback调用
   * @param {Error} error 错误对象
   * @param {string} stateName 状态名称
   */
  async handleStateError (error, stateName) {
    console.error(`[PhaseManager] 状态 ${stateName} 错误:`, error)

    // 委托给PhaseCoordinator处理
    if (this.phaseCoordinator) {
      return await this.phaseCoordinator.handlePhaseError(error, { stateName, phaseIndex: this.currentPhaseIndex })
    }

    // 默认错误处理
    await this.handlePhaseError(error, 'state_execution')
    return { handled: true }
  }

  /**
   * 处理阶段错误
   * @param {Error} error - 错误对象
   * @param {string} context - 错误上下文
   */
  async handlePhaseError (error, context) {
    try {
      console.error(`[PhaseManager] 阶段错误 (${context}):`, error)

      // 记录错误历史
      this.recordPhaseHistory('error', context, { error: error.message })

      // 检查是否需要重试
      if (this.retryCount < this.maxRetries && context !== 'transition') {
        this.retryCount++
        console.log(`[PhaseManager] 尝试重试 (${this.retryCount}/${this.maxRetries})`)

        // 延迟重试
        setTimeout(() => {
          this.startPhase(this.currentPhaseIndex)
        }, 1000 * this.retryCount) // 递增延迟

        return
      }

      // 替换：this.emit('phaseError', {...})
      if (this.phaseCoordinator) {
        await this.phaseCoordinator.handlePhaseError(error, {
          context,
          phaseIndex: this.currentPhaseIndex,
          retryCount: this.retryCount
        })
      }

      // 替换：this.game.emit('error', new GameError(...))
      await this.game.notificationCenter.handleError(
        new GameError(
          `阶段管理错误: ${error.message}`,
          'PHASE_MANAGER_ERROR',
          { context, phaseIndex: this.currentPhaseIndex, error }
        )
      )
    } catch (handlingError) {
      console.error('[PhaseManager] 处理阶段错误时发生异常:', handlingError)
    }
  }

  /**
   * 记录阶段历史
   * @param {string} action - 行动类型
   * @param {string} phaseName - 阶段名称
   * @param {Object} data - 额外数据
   */
  recordPhaseHistory (action, phaseName, data = {}) {
    const historyEntry = {
      action,
      phaseName,
      phaseIndex: this.currentPhaseIndex,
      timestamp: Date.now(),
      ...data
    }

    this.phaseHistory.push(historyEntry)

    // 限制历史记录长度
    if (this.phaseHistory.length > 100) {
      this.phaseHistory.shift()
    }
  }

  // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:51:10 +08:00; Reason: Shrimp Task ID: #e18d361a-009f-4c79-896e-75ac0bb4b038, 完全删除savePhaseState方法; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
  // 已删除savePhaseState方法

  /**
   * 获取当前阶段信息
   */
  getCurrentPhaseInfo () {
    if (this.currentPhaseIndex >= this.phaseOrder.length) {
      return null
    }

    return {
      phaseConfig: this.phaseOrder[this.currentPhaseIndex],
      phaseIndex: this.currentPhaseIndex,
      phaseState: this.currentPhaseState,
      isTransitioning: this.isTransitioning
    }
  }

  /**
   * 获取阶段历史
   */
  getPhaseHistory () {
    return [...this.phaseHistory]
  }

  /**
   * 获取当前阶段状态
   * @returns {Object|null} 当前阶段状态实例
   */
  getCurrentPhaseState () {
    return this.currentPhaseState
  }

  /**
   * 清理阶段管理器
   */
  async cleanup () {
    try {
      console.log('[PhaseManager] 开始清理阶段管理器')

      // 移除事件监听器清理：现在使用回调函数，无需清理事件监听器

      // 清理阶段状态缓存
      this.phaseStates.clear()

      // 重置状态
      this.currentPhaseIndex = 0
      this.currentPhaseState = null
      this.isTransitioning = false
      this.retryCount = 0

      // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:51:10 +08:00; Reason: Shrimp Task ID: #e18d361a-009f-4c79-896e-75ac0bb4b038, 移除持久化状态清理逻辑; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
      // 移除了持久化状态清理相关代码

      console.log('[PhaseManager] 阶段管理器清理完成')
    } catch (error) {
      console.error('[PhaseManager] 清理阶段管理器失败:', error)
    }
  }
}
