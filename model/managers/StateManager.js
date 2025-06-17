// {{CHENGQI:
// Action: Created; Timestamp: 2025-01-16 06:05:00; Reason: Shrimp Task ID: #992f3b47-a84d-440a-8b3a-8e1d11476383, 创建StateManager类分离状态管理职责;
// }}
// {{START MODIFICATIONS}}

import { NightState } from '../action/NightState.js'
import { GameError } from '../core/GameError.js'
import { GAME_PHASES } from '../core/Constants.js'

/**
 * 状态管理器 - 负责管理游戏状态转换和状态机操作
 * 分离自Game类的状态管理职责
 */
export class StateManager {
  constructor (game, stateMachine) {
    this.game = game
    this.stateMachine = stateMachine
    this.currentPhase = GAME_PHASES.WAITING
    this.turn = 0
    this.stateHistory = [] // 状态历史记录

    // 持久化配置
    this.persistenceEnabled = true
    this.redis = global.redis
    this.persistenceKeyPrefix = 'werewolf:gamestate:'

    // 设置状态机上下文
    if (this.stateMachine) {
      this.stateMachine.setContext(this.game)
    }
  }

  /**
   * 初始化游戏状态
   * 设置游戏的初始状态
   */
  async initializeState () {
    try {
      // 修改为从夜晚开始
      const initialState = new NightState(this.game)
      await this.changeState(initialState)
      this.currentPhase = GAME_PHASES.NIGHT
      this.turn = 1

      console.log('[StateManager] 游戏状态初始化完成，进入夜晚阶段')
    } catch (error) {
      console.error('[StateManager] 初始化游戏状态失败:', error)
      this.game.emit('error', new GameError(
        '初始化游戏状态失败',
        'STATE_INIT_ERROR',
        { error }
      ))
    }
  }

  /**
   * 改变游戏状态
   * @param {GameState} newState 新状态
   */
  async changeState (newState) {
    try {
      if (!newState) {
        throw new GameError('新状态不能为空', 'INVALID_STATE')
      }

      const oldState = this.getCurrentState()

      // 记录状态变更历史
      this.stateHistory.push({
        from: oldState ? oldState.getName() : 'none',
        to: newState.getName(),
        timestamp: Date.now(),
        turn: this.turn
      })

      // 委派给状态机
      await this.stateMachine.changeState(newState)

      // 更新当前阶段
      this.updateCurrentPhase(newState)

      console.log(`[StateManager] 状态转换: ${oldState?.getName() || 'none'} -> ${newState.getName()}`)

      // 发出状态变更事件
      this.game.emit('stateChanged', {
        oldState: oldState?.getName() || 'none',
        newState: newState.getName(),
        turn: this.turn,
        phase: this.currentPhase
      })

      // 自动保存游戏状态
      await this.saveGameState()
    } catch (error) {
      console.error('[StateManager] 状态转换失败:', error)
      this.game.emit('error', new GameError(
        '状态转换失败',
        'STATE_CHANGE_ERROR',
        { newState: newState?.getName(), error }
      ))
    }
  }

  /**
   * 获取当前状态
   * @returns {GameState|null} 当前状态
   */
  getCurrentState () {
    return this.stateMachine ? this.stateMachine.getCurrentState() : null
  }

  /**
   * 获取当前游戏阶段
   * @returns {string} 当前阶段
   */
  getCurrentPhase () {
    return this.currentPhase
  }

  /**
   * 获取当前回合数
   * @returns {number} 回合数
   */
  getCurrentTurn () {
    return this.turn
  }

  /**
   * 保存游戏状态到Redis
   * @returns {Promise<boolean>} 保存是否成功
   */
  async saveGameState () {
    if (!this.persistenceEnabled || !this.redis) {
      return false
    }

    try {
      const groupId = this.game.groupId || this.game.id
      if (!groupId) {
        console.warn('[StateManager] 无法保存状态：缺少groupId')
        return false
      }

      const currentState = this.getCurrentState()
      const stateData = {
        groupId,
        currentPhase: this.currentPhase,
        currentStateName: currentState ? currentState.getName() : null,
        turn: this.turn,
        stateHistory: this.stateHistory,
        timestamp: Date.now(),
        version: '1.0'
      }

      const key = `${this.persistenceKeyPrefix}${groupId}`
      await this.redis.set(key, JSON.stringify(stateData), { EX: 86400 }) // 24小时过期

      console.log(`[StateManager] 游戏状态已保存: ${groupId}`)
      return true
    } catch (error) {
      console.error('[StateManager] 保存游戏状态失败:', error)
      return false
    }
  }

  /**
   * 从Redis加载游戏状态
   * @param {string} groupId 群组ID
   * @returns {Promise<Object|null>} 加载的状态数据
   */
  async loadGameState (groupId) {
    if (!this.persistenceEnabled || !this.redis) {
      return null
    }

    try {
      const key = `${this.persistenceKeyPrefix}${groupId}`
      const stateDataStr = await this.redis.get(key)

      if (!stateDataStr) {
        return null
      }

      const stateData = JSON.parse(stateDataStr)

      // 验证数据完整性
      if (!stateData.groupId || !stateData.timestamp) {
        console.warn('[StateManager] 状态数据格式无效')
        await this.clearGameState(groupId)
        return null
      }

      // 检查数据是否过期（超过24小时）
      const now = Date.now()
      const age = now - stateData.timestamp
      if (age > 86400000) { // 24小时
        console.log('[StateManager] 状态数据已过期，自动清理')
        await this.clearGameState(groupId)
        return null
      }

      console.log(`[StateManager] 游戏状态已加载: ${groupId}`)
      return stateData
    } catch (error) {
      console.error('[StateManager] 加载游戏状态失败:', error)
      return null
    }
  }

  /**
   * 清理指定群组的游戏状态
   * @param {string} groupId 群组ID
   * @returns {Promise<boolean>} 清理是否成功
   */
  async clearGameState (groupId) {
    if (!this.persistenceEnabled || !this.redis) {
      return false
    }

    try {
      const key = `${this.persistenceKeyPrefix}${groupId}`
      await this.redis.del(key)
      console.log(`[StateManager] 游戏状态已清理: ${groupId}`)
      return true
    } catch (error) {
      console.error('[StateManager] 清理游戏状态失败:', error)
      return false
    }
  }

  /**
   * 检查是否存在持久化的游戏状态
   * @param {string} groupId 群组ID
   * @returns {Promise<boolean>} 是否存在状态
   */
  async hasPersistedState (groupId) {
    if (!this.persistenceEnabled || !this.redis) {
      return false
    }

    try {
      const key = `${this.persistenceKeyPrefix}${groupId}`
      const exists = await this.redis.exists(key)
      return exists === 1
    } catch (error) {
      console.error('[StateManager] 检查持久化状态失败:', error)
      return false
    }
  }

  /**
   * 清理所有过期的游戏状态
   * @returns {Promise<number>} 清理的状态数量
   */
  async cleanupExpiredStates () {
    if (!this.persistenceEnabled || !this.redis) {
      return 0
    }

    try {
      const pattern = `${this.persistenceKeyPrefix}*`
      const keys = await this.redis.keys(pattern)
      let cleanedCount = 0
      const now = Date.now()

      for (const key of keys) {
        try {
          const stateDataStr = await this.redis.get(key)
          if (!stateDataStr) continue

          const stateData = JSON.parse(stateDataStr)
          const age = now - stateData.timestamp

          // 清理超过24小时的状态
          if (age > 86400000) {
            await this.redis.del(key)
            cleanedCount++
            console.log(`[StateManager] 清理过期状态: ${key}`)
          }
        } catch (error) {
          // 如果解析失败，直接删除
          await this.redis.del(key)
          cleanedCount++
          console.log(`[StateManager] 清理无效状态: ${key}`)
        }
      }

      if (cleanedCount > 0) {
        console.log(`[StateManager] 清理完成，共清理 ${cleanedCount} 个过期状态`)
      }

      return cleanedCount
    } catch (error) {
      console.error('[StateManager] 清理过期状态失败:', error)
      return 0
    }
  }

  /**
   * 增加回合数
   */
  async incrementTurn () {
    this.turn++
    console.log(`[StateManager] 回合数增加到: ${this.turn}`)

    // 发出新回合事件
    this.game.emit('newTurn', {
      turn: this.turn,
      phase: this.currentPhase
    })

    // 保存状态
    await this.saveGameState()
  }

  /**
   * 检查行动是否有效
   * @param {Player} player 玩家
   * @param {string} action 行动
   * @returns {boolean} 是否有效
   */
  isValidAction (player, action) {
    try {
      const currentState = this.getCurrentState()
      if (!currentState) {
        return false
      }

      // 委派给当前状态进行验证
      return currentState.isValidAction(player, action)
    } catch (error) {
      console.error('[StateManager] 验证行动有效性时出错:', error)
      return false
    }
  }

  /**
   * 处理玩家行动
   * @param {Player} player 玩家
   * @param {string} action 行动
   * @param {any} target 目标
   */
  async handleAction (player, action, target) {
    try {
      // 验证玩家对象
      if (typeof player === 'string') {
        const playerId = player
        player = this.game.playerManager.getPlayer(playerId)
        if (!player) {
          this.game.emit('error', new GameError(
            `玩家不存在: ${playerId}`,
            'PLAYER_NOT_FOUND'
          ))
          return
        }
      }

      // 验证行动有效性
      if (!this.isValidAction(player, action)) {
        this.game.emit('error', new GameError(
          '非法操作: 玩家无法执行该动作',
          'INVALID_ACTION'
        ))
        return
      }

      const currentState = this.getCurrentState()
      if (!currentState) {
        this.game.emit('error', new GameError(
          '游戏状态错误: 当前没有活动状态',
          'NO_ACTIVE_STATE'
        ))
        return
      }

      // 委派给当前状态处理
      await currentState.handleAction(player, action, target)
    } catch (err) {
      console.error('[StateManager] 处理玩家行为时出错:', err)
      this.game.emit('error', new GameError(
        err.message,
        'ACTION_ERROR',
        { player, action, target }
      ))
    }
  }

  /**
   * 获取状态历史
   * @returns {Array} 状态历史数组
   */
  getStateHistory () {
    return [...this.stateHistory]
  }

  /**
   * 清理状态管理器
   */
  async cleanup () {
    console.log('[StateManager] 开始清理状态管理器')

    // 清理持久化状态
    const groupId = this.game.groupId || this.game.id
    if (groupId) {
      await this.clearGameState(groupId)
    }

    // 清理状态历史
    this.stateHistory.length = 0

    // 重置状态
    this.currentPhase = GAME_PHASES.WAITING
    this.turn = 0

    console.log('[StateManager] 状态管理器清理完成')
  }

  /**
   * 从持久化数据恢复游戏状态
   * @param {string} groupId 群组ID
   * @returns {Promise<boolean>} 恢复是否成功
   */
  async restoreGameState (groupId) {
    try {
      const stateData = await this.loadGameState(groupId)
      if (!stateData) {
        return false
      }

      // 恢复基本状态
      this.currentPhase = stateData.currentPhase || GAME_PHASES.WAITING
      this.turn = stateData.turn || 0
      this.stateHistory = stateData.stateHistory || []

      console.log(`[StateManager] 游戏状态已恢复: ${groupId}, 回合: ${this.turn}, 阶段: ${this.currentPhase}`)

      // 发出状态恢复事件
      this.game.emit('stateRestored', {
        groupId,
        turn: this.turn,
        phase: this.currentPhase,
        timestamp: stateData.timestamp
      })

      return true
    } catch (error) {
      console.error('[StateManager] 恢复游戏状态失败:', error)
      return false
    }
  }

  /**
   * 获取持久化配置
   * @returns {Object} 持久化配置信息
   */
  getPersistenceConfig () {
    return {
      enabled: this.persistenceEnabled,
      hasRedis: !!this.redis,
      keyPrefix: this.persistenceKeyPrefix
    }
  }

  /**
   * 设置持久化开关
   * @param {boolean} enabled 是否启用持久化
   */
  setPersistenceEnabled (enabled) {
    this.persistenceEnabled = !!enabled
    console.log(`[StateManager] 持久化功能${enabled ? '已启用' : '已禁用'}`)
  }

  /**
   * 更新当前阶段
   * @private
   * @param {GameState} state 当前状态
   */
  updateCurrentPhase (state) {
    if (!state) return

    const stateName = state.getName()

    // 根据状态名称映射到游戏阶段
    switch (stateName) {
      case 'NightState':
        this.currentPhase = GAME_PHASES.NIGHT
        break
      case 'DayDiscussionState':
        this.currentPhase = GAME_PHASES.DAY_DISCUSSION
        break
      case 'DayVotingState':
        this.currentPhase = GAME_PHASES.DAY_VOTING
        break
      case 'SheriffElectionState':
        this.currentPhase = GAME_PHASES.SHERIFF_ELECTION
        break
      default:
        // 保持当前阶段不变
        break
    }
  }

  /**
   * 检查是否可以结束当前状态
   * @returns {boolean} 是否可以结束
   */
  canEndCurrentState () {
    const currentState = this.getCurrentState()
    if (!currentState) return false

    // 如果状态有canEnd方法，则调用它
    if (typeof currentState.canEnd === 'function') {
      return currentState.canEnd()
    }

    // 默认可以结束
    return true
  }

  /**
   * 强制结束当前状态（用于超时等情况）
   */
  async forceEndCurrentState () {
    const currentState = this.getCurrentState()
    if (!currentState) return

    console.log(`[StateManager] 强制结束状态: ${currentState.getName()}`)

    // 如果状态有onTimeout方法，则调用它
    if (typeof currentState.onTimeout === 'function') {
      await currentState.onTimeout()
    }
  }
}

// {{END MODIFICATIONS}}
