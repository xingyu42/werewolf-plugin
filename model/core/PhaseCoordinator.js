/**
 * 阶段协调器 - 替代PhaseManager与NightPhaseController间的事件通信
 * 负责协调夜晚阶段的启动、完成和错误处理，采用直接调用而非事件系统
 */
export class PhaseCoordinator {
  /**
   * 创建阶段协调器
   */
  constructor () {
    this.phaseHistory = []
    this.isCleanedUp = false
  }

  /**
   * 处理阶段开始
   * @param {string} phaseName 阶段名称
   * @param {number} phaseIndex 阶段索引
   * @param {Object} eventData 事件数据
   * @returns {Object} 处理结果
   */
  async handlePhaseStarted (phaseName, phaseIndex, eventData) {
    if (this.isCleanedUp) {
      console.warn('[PhaseCoordinator] 协调器已清理，忽略阶段开始事件')
      return { success: false, reason: 'coordinator_cleaned' }
    }

    try {
      // 记录阶段历史
      this.phaseHistory.push({
        action: 'started',
        phaseName,
        phaseIndex,
        timestamp: Date.now(),
        eventData
      })

      console.log(`[PhaseCoordinator] 阶段开始: ${phaseName} (索引: ${phaseIndex})`)

      return {
        success: true,
        phaseName,
        phaseIndex,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('[PhaseCoordinator] 处理阶段开始失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 处理阶段完成
   * @param {string} phaseName 阶段名称
   * @param {number} phaseIndex 阶段索引
   * @param {Object} results 阶段结果
   * @returns {Object} 处理结果
   */
  async handlePhaseCompleted (phaseName, phaseIndex, results) {
    if (this.isCleanedUp) {
      console.warn('[PhaseCoordinator] 协调器已清理，忽略阶段完成事件')
      return { success: false, reason: 'coordinator_cleaned' }
    }

    try {
      // 记录阶段历史
      this.phaseHistory.push({
        action: 'completed',
        phaseName,
        phaseIndex,
        results,
        timestamp: Date.now()
      })

      console.log(`[PhaseCoordinator] 阶段完成: ${phaseName} (索引: ${phaseIndex})`)

      return {
        success: true,
        shouldContinue: true,
        phaseName,
        phaseIndex,
        results
      }
    } catch (error) {
      console.error('[PhaseCoordinator] 处理阶段完成失败:', error)
      return { success: false, shouldContinue: false, error: error.message }
    }
  }

  /**
   * 处理所有阶段完成
   * @param {number} totalPhases 总阶段数
   * @param {Array} phaseHistory 阶段历史（来自PhaseManager）
   * @returns {Object} 处理结果
   */
  async handleAllPhasesCompleted (totalPhases, phaseHistory) {
    if (this.isCleanedUp) {
      console.warn('[PhaseCoordinator] 协调器已清理，忽略所有阶段完成事件')
      return { success: false, reason: 'coordinator_cleaned' }
    }

    try {
      // 记录完成历史
      this.phaseHistory.push({
        action: 'all_completed',
        totalPhases,
        timestamp: Date.now()
      })

      console.log('[PhaseCoordinator] 所有阶段完成')

      return {
        allCompleted: true,
        totalPhases,
        history: this.phaseHistory,
        managerHistory: phaseHistory
      }
    } catch (error) {
      console.error('[PhaseCoordinator] 处理所有阶段完成失败:', error)
      return { allCompleted: false, error: error.message }
    }
  }

  /**
   * 处理夜晚阶段完成
   * @returns {Object} 处理结果
   */
  async handleNightPhasesCompleted () {
    if (this.isCleanedUp) {
      console.warn('[PhaseCoordinator] 协调器已清理，忽略夜晚阶段完成事件')
      return { success: false, reason: 'coordinator_cleaned' }
    }

    try {
      // 记录夜晚完成
      this.phaseHistory.push({
        action: 'night_completed',
        timestamp: Date.now()
      })

      console.log('[PhaseCoordinator] 夜晚阶段完成')

      return {
        nightCompleted: true,
        shouldTransitionToDay: true,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('[PhaseCoordinator] 处理夜晚阶段完成失败:', error)
      return { nightCompleted: false, error: error.message }
    }
  }

  /**
   * 处理阶段错误
   * @param {Error} error 错误对象
   * @param {Object} context 错误上下文
   * @returns {Object} 处理结果
   */
  async handlePhaseError (error, context) {
    if (this.isCleanedUp) {
      console.warn('[PhaseCoordinator] 协调器已清理，忽略阶段错误事件')
      return { handled: false, reason: 'coordinator_cleaned' }
    }

    try {
      // 记录错误历史
      this.phaseHistory.push({
        action: 'error',
        error: error.message,
        context,
        timestamp: Date.now()
      })

      console.error('[PhaseCoordinator] 阶段错误:', error, context)

      // 简单的错误处理策略
      const shouldRetry = this.shouldRetryPhase(error, context)

      return {
        handled: true,
        shouldRetry,
        error: error.message,
        context
      }
    } catch (handlingError) {
      console.error('[PhaseCoordinator] 处理阶段错误时发生异常:', handlingError)
      return { handled: false, error: handlingError.message }
    }
  }

  /**
   * 判断是否应该重试阶段
   * @param {Error} error 错误对象
   * @param {Object} context 错误上下文
   * @returns {boolean} 是否应该重试
   */
  shouldRetryPhase (error, context) {
    // 简单的重试策略：网络错误或临时错误可以重试
    const retryableErrors = ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'TEMPORARY_ERROR']

    if (error.code && retryableErrors.includes(error.code)) {
      return true
    }

    // 阶段特定的重试策略
    if (context.phaseName === 'InformationPhase' && error.message.includes('角色')) {
      return true
    }

    return false
  }

  /**
   * 获取阶段历史
   * @returns {Array} 阶段历史记录
   */
  getPhaseHistory () {
    return [...this.phaseHistory]
  }

  /**
   * 获取协调器统计信息
   * @returns {Object} 统计信息
   */
  getStats () {
    const totalPhases = this.phaseHistory.filter(h => h.action === 'started').length
    const completedPhases = this.phaseHistory.filter(h => h.action === 'completed').length
    const errorCount = this.phaseHistory.filter(h => h.action === 'error').length

    return {
      totalPhases,
      completedPhases,
      errorCount,
      isCleanedUp: this.isCleanedUp,
      historyLength: this.phaseHistory.length
    }
  }

  /**
   * 清理协调器资源
   */
  cleanup () {
    if (this.isCleanedUp) {
      console.debug('[PhaseCoordinator] 已经清理过，跳过重复清理')
      return
    }

    console.log('[PhaseCoordinator] 开始清理阶段协调器...')

    try {
      // 标记为已清理
      this.isCleanedUp = true

      // 清理历史记录
      this.phaseHistory.length = 0

      console.log('[PhaseCoordinator] 阶段协调器清理完成')
    } catch (error) {
      console.error('[PhaseCoordinator] 清理阶段协调器时发生错误:', error)
    }
  }
}
