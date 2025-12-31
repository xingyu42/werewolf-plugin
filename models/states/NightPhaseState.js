/**
 * @file NightPhaseState.js
 * @description 夜晚阶段状态基类，提供阶段管理的通用功能
 * @module model/strategies/states/NightPhaseState
 *
 * @input GameError
 * @output NightPhaseState - 夜晚阶段基类
 * @pos 策略层 - 夜晚子阶段基类，回调机制替代事件系统
 *
 * @dependencies
 * - ../../core/GameError.js - 游戏错误
 */
import { GameError } from '../../utils/GameError.js'

export class NightPhaseState {
  constructor (game, phaseConfig) {
    // 移除EventEmitter构造函数调用

    // 阶段配置验证
    if (!phaseConfig) {
      throw new GameError('阶段配置不能为空', 'INVALID_PHASE_CONFIG')
    }

    // 从GameState继承的属性
    this.game = game
    this.timer = null

    // 阶段特有属性
    this.phaseConfig = phaseConfig
    this.activeRoles = new Set() // 当前阶段活跃的角色
    this.completedActions = new Map() // 已完成行动的玩家记录 playerId -> actionData
    this.phaseTimeout = null // 阶段超时定时器
    this.phaseStartTime = null // 阶段开始时间
    this.isPhaseCompleted = false // 阶段是否已完成

    // 并行处理支持
    this.parallelActions = new Map() // 并行行动记录 playerId -> Promise
    this.roleActionPromises = new Map() // 角色行动Promise记录 roleType -> Promise[]

    // 回调机制替代事件系统
    this.completionCallback = null // 阶段完成回调
    this.errorCallback = null // 阶段错误回调

    // 设置阶段超时时间
    this.timeLimit = Math.floor(phaseConfig.timeout / 1000) // 转换为秒
  }

  /**
   * 进入阶段状态
   */
  async onEnter () {
    // 手动实现GameState的onEnter逻辑
    if (!this.game) {
      console.error(`${this.constructor.name}.onEnter: game 对象为 undefined`)
      return
    }

    // 设置超时处理
    if (this.timeLimit > 0) {
      this.timer = setTimeout(async () => {
        await this.onTimeout()
      }, this.timeLimit * 1000)
    }

    try {
      this.phaseStartTime = Date.now()
      this.isPhaseCompleted = false
      this.completedActions.clear()
      this.parallelActions.clear()
      this.roleActionPromises.clear()

      // 识别当前阶段的活跃角色
      await this.identifyActiveRoles()

      // 发送阶段开始通知
      await this.notifyPhaseStart()

      // 启动阶段逻辑
      await this.startPhaseLogic()

      console.log(`[${this.constructor.name}] 阶段开始: ${this.phaseConfig.name}`)
    } catch (error) {
      console.error(`[${this.constructor.name}] 进入阶段时发生错误:`, error)
      // 替换emit调用为回调机制
      if (this.errorCallback) {
        await this.errorCallback(new GameError(
          `进入${this.phaseConfig.name}阶段失败`,
          'PHASE_ENTER_ERROR',
          { phase: this.phaseConfig.name, error }
        ))
      }
    }
  }

  /**
   * 退出阶段状态
   */
  async onExit () {
    try {
      // 清理阶段超时定时器
      if (this.phaseTimeout) {
        clearTimeout(this.phaseTimeout)
        this.phaseTimeout = null
      }

      // 等待所有并行行动完成
      await this.waitForParallelActions()

      // 执行阶段清理逻辑
      await this.cleanupPhase()

      console.log(`[${this.constructor.name}] 阶段结束: ${this.phaseConfig.name}`)
    } catch (error) {
      console.error(`[${this.constructor.name}] 退出阶段时发生错误:`, error)
    } finally {
      // 手动实现GameState的onExit逻辑
      if (this.timer) {
        clearTimeout(this.timer)
        this.timer = null
      }
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
      // 基础验证
      if (!this.isValidAction(player, action)) {
        throw new GameError('无效的行动', 'INVALID_ACTION', {
          playerId: player.id,
          action,
          phase: this.phaseConfig.name
        })
      }

      // 检查是否已完成行动
      if (this.completedActions.has(player.id)) {
        throw new GameError('玩家已完成行动', 'ACTION_ALREADY_COMPLETED', {
          playerId: player.id,
          phase: this.phaseConfig.name
        })
      }

      // 执行具体的行动处理逻辑（由子类实现）
      const result = await this.executePlayerAction(player, action, data)

      // 记录完成的行动
      this.completedActions.set(player.id, {
        player,
        action,
        data,
        result,
        timestamp: Date.now()
      })

      // 检查阶段是否完成
      await this.checkPhaseCompletion()

      return result
    } catch (error) {
      console.error(`[${this.constructor.name}] 处理玩家行动时发生错误:`, error)
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
      if (!player || !action) {
        return false
      }

      // 检查玩家是否存活
      if (!player.isAlive()) {
        return false
      }

      // 检查阶段是否已完成
      if (this.isPhaseCompleted) {
        return false
      }

      // 检查玩家角色是否在当前阶段活跃
      const playerRole = player.role?.constructor.name.replace('Role', '').toUpperCase()
      if (!this.activeRoles.has(playerRole)) {
        return false
      }

      // 检查行动是否在允许的行动列表中
      const allowedActions = this.phaseConfig.requiredActions[playerRole] || []
      if (!allowedActions.includes(action)) {
        return false
      }

      // 子类可以重写此方法添加更多验证逻辑
      return this.validateSpecificAction(player, action)
    } catch (error) {
      console.error(`[${this.constructor.name}] 验证行动时发生错误:`, error)
      return false
    }
  }

  /**
   * 阶段超时处理
   */
  async onTimeout () {
    try {
      console.log(`[${this.constructor.name}] 阶段超时: ${this.phaseConfig.name}`)

      // 为未行动的玩家设置默认行动
      await this.handleTimeoutActions()

      // 强制完成阶段
      await this.forceCompletePhase()
    } catch (error) {
      console.error(`[${this.constructor.name}] 处理阶段超时时发生错误:`, error)
    }
  }

  // ==================== 抽象方法 - 子类必须实现 ====================

  /**
   * 执行具体的玩家行动逻辑
   * @param {Object} player - 玩家对象
   * @param {string} action - 行动类型
   * @param {*} data - 行动数据
   * @returns {Promise<*>} 行动结果
   */
  async executePlayerAction (player, action, data) {
    throw new Error('子类必须实现executePlayerAction方法')
  }

  /**
   * 验证特定行动的有效性
   * @param {Object} player - 玩家对象
   * @param {string} action - 行动类型
   * @returns {boolean} 是否有效
   */
  validateSpecificAction (player, action) {
    return true // 默认允许，子类可以重写
  }

  /**
   * 启动阶段逻辑
   */
  async startPhaseLogic () {
    throw new Error('子类必须实现startPhaseLogic方法')
  }

  /**
   * 处理超时行动
   */
  async handleTimeoutActions () {
    throw new Error('子类必须实现handleTimeoutActions方法')
  }

  // ==================== 回调机制方法 ====================

  /**
   * 设置阶段完成回调
   * @param {Function} callback 完成回调函数
   */
  setCompletionCallback (callback) {
    this.completionCallback = callback
  }

  /**
   * 设置阶段错误回调
   * @param {Function} callback 错误回调函数
   */
  setErrorCallback (callback) {
    this.errorCallback = callback
  }

  // ==================== 通用辅助方法 ====================

  /**
   * 识别当前阶段的活跃角色
   */
  async identifyActiveRoles () {
    this.activeRoles.clear()

    for (const role of this.phaseConfig.roles) {
      // 检查是否有该角色的存活玩家
      const alivePlayers = this.game.getAlivePlayers({ roleType: role + 'Role', includeRole: true })
      if (alivePlayers.length > 0) {
        this.activeRoles.add(role)
      }
    }

    console.log(`[${this.constructor.name}] 活跃角色:`, Array.from(this.activeRoles))
  }

  /**
   * 发送阶段开始通知
   */
  async notifyPhaseStart () {
    try {
      // 发送阶段开始通知
      const message = `🌙 ${this.phaseConfig.description || this.phaseConfig.name}开始，请查看私聊消息`
      await this.game.e.reply(message)
    } catch (error) {
      console.error(`[${this.constructor.name}] 发送阶段开始通知失败:`, error)
    }
  }

  /**
   * 检查阶段是否完成
   */
  async checkPhaseCompletion () {
    if (this.isPhaseCompleted) {
      return
    }

    // 检查所有活跃角色的玩家是否都已完成行动
    let allCompleted = true

    for (const role of this.activeRoles) {
      const rolePlayers = this.game.getAlivePlayers({ roleType: role + 'Role', includeRole: true })
      const completedCount = rolePlayers.filter(({ player }) =>
        this.completedActions.has(player.id)
      ).length

      if (completedCount < rolePlayers.length) {
        allCompleted = false
        break
      }
    }

    if (allCompleted) {
      await this.completePhase()
    }
  }

  /**
   * 完成阶段
   */
  async completePhase () {
    if (this.isPhaseCompleted) {
      return
    }

    this.isPhaseCompleted = true

    try {
      // 等待所有并行行动完成
      await this.waitForParallelActions()

      // 执行阶段完成逻辑（由子类实现）
      await this.onPhaseComplete()

      console.log(`[${this.constructor.name}] 阶段完成: ${this.phaseConfig.name}`)

      // 替换emit调用为回调机制
      if (this.completionCallback) {
        await this.completionCallback({
          phaseName: this.phaseConfig.name,
          phaseStats: this.getPhaseStats()
        })
      }
    } catch (error) {
      console.error(`[${this.constructor.name}] 完成阶段时发生错误:`, error)
      // 替换emit调用为回调机制
      if (this.errorCallback) {
        await this.errorCallback(error)
      }
    }
  }

  /**
   * 强制完成阶段（超时时调用）
   */
  async forceCompletePhase () {
    console.log(`[${this.constructor.name}] 强制完成阶段: ${this.phaseConfig.name}`)
    await this.completePhase()
  }

  /**
   * 等待所有并行行动完成
   */
  async waitForParallelActions () {
    if (this.parallelActions.size > 0) {
      try {
        await Promise.allSettled(Array.from(this.parallelActions.values()))
      } catch (error) {
        console.error(`[${this.constructor.name}] 等待并行行动完成时发生错误:`, error)
      }
    }
  }

  /**
   * 阶段完成时的处理逻辑（子类可重写）
   */
  async onPhaseComplete () {
    // 默认实现：转换到下一个阶段或状态
    // 子类可以重写此方法实现特定逻辑
  }

  /**
   * 清理阶段资源
   */
  async cleanupPhase () {
    // 清理并行行动记录
    this.parallelActions.clear()
    this.roleActionPromises.clear()

    // 子类可以重写此方法添加更多清理逻辑
  }

  /**
   * 获取阶段统计信息
   */
  getPhaseStats () {
    return {
      phaseName: this.phaseConfig.name,
      startTime: this.phaseStartTime,
      duration: this.phaseStartTime ? Date.now() - this.phaseStartTime : 0,
      activeRoles: Array.from(this.activeRoles),
      completedActions: this.completedActions.size,
      isCompleted: this.isPhaseCompleted
    }
  }

  // ==================== 从GameState继承的方法 ====================

  /**
   * 获取当前状态名称
   */
  getName () {
    return this.constructor.name
  }

  /**
   * 检查行动是否有效（基础版本，已在上面重写）
   */
  isValidActionBase (player, action) {
    if (!this.game) {
      console.error(`${this.constructor.name}.isValidAction: game 对象为 undefined`)
      return false
    }
    return false // 默认所有行动无效
  }
}
