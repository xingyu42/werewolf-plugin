/**
 * 夜晚阶段状态基类
 * 继承自GameState，提供阶段管理的通用功能
 * 支持阶段配置管理、角色状态跟踪、并行处理、超时处理等核心功能
 * 
 * {{CHENGQI: Action: Added; Timestamp: 2025-06-19 19:47:18 +08:00; Reason: Shrimp Task ID: #b1b5566f-4817-4b93-8b59-33c05197ccf9, 创建夜晚阶段状态基类; Principle_Applied: SOLID-SRP-SingleResponsibility-OCP-OpenClosedPrinciple;}}
 */

import { GameState } from './GameState.js'
import { SimpleStateNotifier } from '../adapters/SimpleStateNotifier.js'
import { GameError } from '../core/GameError.js'
import { NIGHT_PHASE_CONFIG, ROLES, ACTIONS } from '../core/Constants.js'

export class NightPhaseState extends GameState {
  constructor (game, phaseConfig) {
    super(game)
    
    // 阶段配置验证
    if (!phaseConfig) {
      throw new GameError('阶段配置不能为空', 'INVALID_PHASE_CONFIG')
    }
    
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
    
    // 设置阶段超时时间
    this.timeLimit = Math.floor(phaseConfig.timeout / 1000) // 转换为秒
  }

  /**
   * 进入阶段状态
   */
  async onEnter () {
    await super.onEnter()
    
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
      this.game.emit('error', new GameError(
        `进入${this.phaseConfig.name}阶段失败`,
        'PHASE_ENTER_ERROR',
        { phase: this.phaseConfig.name, error }
      ))
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
      // 使用SimpleStateNotifier发送通知
      await SimpleStateNotifier.notifyPhaseStart(
        this.game, 
        this.phaseConfig.name, 
        this.phaseConfig.description,
        this.game.e
      )
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
    } catch (error) {
      console.error(`[${this.constructor.name}] 完成阶段时发生错误:`, error)
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
}
