/**
 * @file TimerMock.js
 * @description 定时器 Mock 模块，用于控制游戏中的异步超时
 * @module tests/e2e/TimerMock
 *
 * 方案 B：Mock 超时机制，让所有 setTimeout 立即执行或可控执行
 */

/**
 * 定时器控制器
 * 拦截 setTimeout/setInterval，允许手动触发或立即执行
 */
export class TimerController {
  constructor () {
    this.pendingTimers = new Map() // id -> { callback, delay, type }
    this.nextId = 1
    this.originalSetTimeout = null
    this.originalSetInterval = null
    this.originalClearTimeout = null
    this.originalClearInterval = null
    this.isInstalled = false
    this.mode = 'immediate' // 'immediate' | 'manual' | 'fast'
    this.fastMultiplier = 0.01 // fast 模式下的时间倍率
  }

  /**
   * 安装 Mock（替换全局 setTimeout/setInterval）
   * @param {string} mode - 'immediate'(立即执行) | 'manual'(手动触发) | 'fast'(快速执行)
   */
  install (mode = 'immediate') {
    if (this.isInstalled) return

    this.mode = mode
    this.originalSetTimeout = global.setTimeout
    this.originalSetInterval = global.setInterval
    this.originalClearTimeout = global.clearTimeout
    this.originalClearInterval = global.clearInterval

    const self = this

    global.setTimeout = (callback, delay, ...args) => {
      return self._handleSetTimeout(callback, delay, args)
    }

    global.setInterval = (callback, delay, ...args) => {
      return self._handleSetInterval(callback, delay, args)
    }

    global.clearTimeout = (id) => {
      self.pendingTimers.delete(id)
    }

    global.clearInterval = (id) => {
      self.pendingTimers.delete(id)
    }

    this.isInstalled = true
  }

  /**
   * 卸载 Mock（恢复原始函数）
   */
  uninstall () {
    if (!this.isInstalled) return

    global.setTimeout = this.originalSetTimeout
    global.setInterval = this.originalSetInterval
    global.clearTimeout = this.originalClearTimeout
    global.clearInterval = this.originalClearInterval

    this.pendingTimers.clear()
    this.isInstalled = false
  }

  /**
   * 处理 setTimeout 调用
   */
  _handleSetTimeout (callback, delay, args) {
    const id = this.nextId++

    if (this.mode === 'immediate') {
      // 立即执行（使用 setImmediate 或 process.nextTick 保持异步）
      setImmediate(() => {
        try {
          callback(...args)
        } catch (e) {
          console.error('[TimerMock] Callback error:', e)
        }
      })
      return id
    }

    if (this.mode === 'fast') {
      // 快速执行（使用极短延迟）
      const fastDelay = Math.max(1, Math.floor(delay * this.fastMultiplier))
      const realId = this.originalSetTimeout(() => {
        this.pendingTimers.delete(id)
        try {
          callback(...args)
        } catch (e) {
          console.error('[TimerMock] Callback error:', e)
        }
      }, fastDelay)

      this.pendingTimers.set(id, { callback, delay, args, type: 'timeout', realId })
      return id
    }

    // manual 模式：存储但不执行
    this.pendingTimers.set(id, { callback, delay, args, type: 'timeout' })
    return id
  }

  /**
   * 处理 setInterval 调用
   */
  _handleSetInterval (callback, delay, args) {
    const id = this.nextId++

    if (this.mode === 'immediate' || this.mode === 'fast') {
      // interval 在测试中通常不需要，直接忽略或执行一次
      setImmediate(() => {
        try {
          callback(...args)
        } catch (e) {
          console.error('[TimerMock] Interval callback error:', e)
        }
      })
      return id
    }

    this.pendingTimers.set(id, { callback, delay, args, type: 'interval' })
    return id
  }

  /**
   * 手动触发指定定时器
   */
  async trigger (id) {
    const timer = this.pendingTimers.get(id)
    if (!timer) return false

    this.pendingTimers.delete(id)
    try {
      await timer.callback(...timer.args)
    } catch (e) {
      console.error('[TimerMock] Trigger error:', e)
    }
    return true
  }

  /**
   * 触发所有待执行的定时器
   */
  async triggerAll () {
    const timers = [...this.pendingTimers.entries()]
    for (const [id, timer] of timers) {
      if (timer.type === 'timeout') {
        this.pendingTimers.delete(id)
        try {
          await timer.callback(...timer.args)
        } catch (e) {
          console.error('[TimerMock] TriggerAll error:', e)
        }
      }
    }
  }

  /**
   * 按延迟顺序触发定时器
   */
  async advanceTime (ms) {
    const timers = [...this.pendingTimers.entries()]
      .filter(([, t]) => t.type === 'timeout' && t.delay <= ms)
      .sort((a, b) => a[1].delay - b[1].delay)

    for (const [id, timer] of timers) {
      this.pendingTimers.delete(id)
      try {
        await timer.callback(...timer.args)
      } catch (e) {
        console.error('[TimerMock] AdvanceTime error:', e)
      }
    }

    // 减少剩余定时器的延迟
    this.pendingTimers.forEach((timer) => {
      timer.delay = Math.max(0, timer.delay - ms)
    })
  }

  /**
   * 获取待执行定时器数量
   */
  getPendingCount () {
    return this.pendingTimers.size
  }

  /**
   * 清空所有待执行定时器
   */
  clear () {
    // 清理 fast 模式下的真实定时器
    if (this.mode === 'fast') {
      this.pendingTimers.forEach((timer) => {
        if (timer.realId) {
          this.originalClearTimeout(timer.realId)
        }
      })
    }
    this.pendingTimers.clear()
  }

  /**
   * 等待所有 immediate 执行完成
   */
  async flush () {
    return new Promise(resolve => setImmediate(resolve))
  }
}

// 全局单例
export const timerController = new TimerController()

/**
 * 便捷函数：安装并返回控制器
 */
export function installTimerMock (mode = 'immediate') {
  timerController.install(mode)
  return timerController
}

/**
 * 便捷函数：卸载定时器 Mock
 */
export function uninstallTimerMock () {
  timerController.uninstall()
}

export default timerController
