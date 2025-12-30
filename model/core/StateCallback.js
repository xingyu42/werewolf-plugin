/**
 * @file StateCallback.js
 * @description 状态回调接口，处理状态完成和错误的回调
 * @module model/core/StateCallback
 *
 * @input 无
 * @output StateCallback - 状态回调类
 * @pos 核心层 - 状态回调，替代事件通信
 *
 * @dependencies 无
 */
export class StateCallback {
  /**
   * 创建状态回调接口
   * @param {Object} phaseManager PhaseManager实例
   */
  constructor (phaseManager) {
    this.phaseManager = phaseManager
    this.isCleanedUp = false
    this.callbackHistory = []
  }

  /**
   * 处理状态完成回调
   * @param {string} stateName 状态名称
   * @param {Object} results 状态结果
   * @returns {Object} 处理结果
   */
  async onStateCompleted (stateName, results) {
    if (this.isCleanedUp) {
      console.warn('[StateCallback] 回调接口已清理，忽略状态完成')
      return { handled: false, reason: 'callback_cleaned' }
    }

    try {
      // 记录回调历史
      this.callbackHistory.push({
        type: 'completion',
        stateName,
        results,
        timestamp: Date.now()
      })

      console.log(`[StateCallback] 状态完成回调: ${stateName}`)

      // 委托给PhaseManager处理
      if (this.phaseManager && typeof this.phaseManager.handleStateCompletion === 'function') {
        const result = await this.phaseManager.handleStateCompletion(stateName, results)
        return { handled: true, result }
      } else {
        console.warn('[StateCallback] PhaseManager不可用或缺少handleStateCompletion方法')
        return { handled: false, reason: 'manager_unavailable' }
      }
    } catch (error) {
      console.error('[StateCallback] 处理状态完成回调失败:', error)

      // 记录错误到历史
      this.callbackHistory.push({
        type: 'completion_error',
        stateName,
        error: error.message,
        timestamp: Date.now()
      })

      return { handled: false, error: error.message }
    }
  }

  /**
   * 处理状态错误回调
   * @param {Error} error 错误对象
   * @param {string} stateName 状态名称
   * @returns {Object} 处理结果
   */
  async onStateError (error, stateName) {
    if (this.isCleanedUp) {
      console.warn('[StateCallback] 回调接口已清理，忽略状态错误')
      return { handled: false, reason: 'callback_cleaned' }
    }

    try {
      // 记录回调历史
      this.callbackHistory.push({
        type: 'error',
        stateName,
        error: error.message,
        timestamp: Date.now()
      })

      console.error(`[StateCallback] 状态错误回调: ${stateName}`, error)

      // 委托给PhaseManager处理
      if (this.phaseManager && typeof this.phaseManager.handleStateError === 'function') {
        const result = await this.phaseManager.handleStateError(error, stateName)
        return { handled: true, result }
      } else {
        console.warn('[StateCallback] PhaseManager不可用或缺少handleStateError方法')
        return { handled: false, reason: 'manager_unavailable' }
      }
    } catch (handlingError) {
      console.error('[StateCallback] 处理状态错误回调失败:', handlingError)

      // 记录处理错误到历史
      this.callbackHistory.push({
        type: 'error_handling_error',
        stateName,
        originalError: error.message,
        handlingError: handlingError.message,
        timestamp: Date.now()
      })

      return { handled: false, error: handlingError.message }
    }
  }

  /**
   * 设置PhaseManager引用
   * @param {Object} phaseManager PhaseManager实例
   */
  setPhaseManager (phaseManager) {
    if (this.isCleanedUp) {
      console.warn('[StateCallback] 回调接口已清理，无法设置PhaseManager')
      return
    }

    this.phaseManager = phaseManager
    console.log('[StateCallback] PhaseManager引用已更新')
  }

  /**
   * 获取回调历史
   * @returns {Array} 回调历史记录
   */
  getCallbackHistory () {
    return [...this.callbackHistory]
  }

  /**
   * 获取回调统计信息
   * @returns {Object} 统计信息
   */
  getStats () {
    const completionCallbacks = this.callbackHistory.filter(h => h.type === 'completion').length
    const errorCallbacks = this.callbackHistory.filter(h => h.type === 'error').length
    const handlingErrors = this.callbackHistory.filter(h => h.type.includes('error')).length

    return {
      completionCallbacks,
      errorCallbacks,
      handlingErrors,
      totalCallbacks: this.callbackHistory.length,
      isCleanedUp: this.isCleanedUp,
      hasPhaseManager: !!this.phaseManager
    }
  }

  /**
   * 清理回调接口资源
   */
  cleanup () {
    if (this.isCleanedUp) {
      console.debug('[StateCallback] 已经清理过，跳过重复清理')
      return
    }

    console.log('[StateCallback] 开始清理状态回调接口...')

    try {
      // 标记为已清理
      this.isCleanedUp = true

      // 清理引用
      this.phaseManager = null

      // 清理历史记录
      this.callbackHistory.length = 0

      console.log('[StateCallback] 状态回调接口清理完成')
    } catch (error) {
      console.error('[StateCallback] 清理状态回调接口时发生错误:', error)
    }
  }
}
