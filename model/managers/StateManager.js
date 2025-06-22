import { NightPhaseController } from '../action/NightPhaseController.js'
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

    // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:43:43 +08:00; Reason: Shrimp Task ID: #a6ff8dd3-5eec-4efb-81bc-ffd467ecc6d6, 完全移除Redis持久化相关属性; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
    // 移除了所有Redis持久化相关属性：persistenceEnabled, redis, persistenceKeyPrefix

    // 设置状态机上下文
    if (this.stateMachine) {
      this.stateMachine.setContext(this.game)
    }
  }

  /**
   * 初始化游戏状态
   * 设置游戏的初始状态
   *
   * {{CHENGQI: Action: Modified; Timestamp: 2025-06-19 21:15:45 +08:00; Reason: Shrimp Task ID: #f2c4abaa-ef74-4813-bd24-e7b778e24087, 切换到新的夜晚阶段控制器; Principle_Applied: SOLID-OCP-OpenClosedPrinciple;}}
   */
  async initializeState () {
    try {
      console.log('[StateManager] 开始初始化游戏状态，使用阶段化夜晚状态控制器')

      // 切换到新的阶段化夜晚状态控制器
      const initialState = new NightPhaseController(this.game)
      await this.changeState(initialState)
      this.currentPhase = GAME_PHASES.NIGHT
      this.turn = 1

      console.log('[StateManager] 游戏状态初始化完成，进入阶段化夜晚流程')

      // 发出初始化完成事件
      this.game.emit('stateInitialized', {
        initialState: 'NightPhaseController',
        turn: this.turn,
        phase: this.currentPhase,
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('[StateManager] 初始化游戏状态失败:', error)

      // 尝试使用简化的夜晚状态回退机制（如果新控制器初始化失败）
      // {{CHENGQI: Action: Modified; Timestamp: 2025-06-21 13:43:14 +08:00; Reason: Shrimp Task ID: #e3f2f046-2904-468a-8913-56be7356be70, 更新回退机制移除NightState依赖; Principle_Applied: SOLID-DIP-DependencyInversion;}}
      try {
        console.log('[StateManager] 尝试使用简化回退机制，跳过夜晚阶段')
        const { DayState } = await import('../action/DayState.js')
        const fallbackState = new DayState(this.game)
        await this.changeState(fallbackState)
        this.currentPhase = GAME_PHASES.DAY
        this.turn = 1

        console.log('[StateManager] 已回退到白天状态，跳过夜晚阶段')
        this.game.emit('stateFallback', {
          fallbackState: 'DayState',
          originalError: error.message,
          skippedPhase: 'NIGHT'
        })
      } catch (fallbackError) {
        console.error('[StateManager] 简化回退机制也失败:', fallbackError)
        this.game.emit('error', new GameError(
          '初始化游戏状态失败，简化回退也失败',
          'STATE_INIT_CRITICAL_ERROR',
          { originalError: error, fallbackError }
        ))
      }
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

      // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:43:43 +08:00; Reason: Shrimp Task ID: #a6ff8dd3-5eec-4efb-81bc-ffd467ecc6d6, 移除自动保存游戏状态调用; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
      // 移除了自动保存游戏状态的调用
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

  // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:43:43 +08:00; Reason: Shrimp Task ID: #a6ff8dd3-5eec-4efb-81bc-ffd467ecc6d6, 完全删除saveGameState方法; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
  // 已删除saveGameState方法

  // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:43:43 +08:00; Reason: Shrimp Task ID: #a6ff8dd3-5eec-4efb-81bc-ffd467ecc6d6, 完全删除loadGameState方法; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
  // 已删除loadGameState方法

  // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:43:43 +08:00; Reason: Shrimp Task ID: #a6ff8dd3-5eec-4efb-81bc-ffd467ecc6d6, 完全删除clearGameState方法; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
  // 已删除clearGameState方法

  // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:43:43 +08:00; Reason: Shrimp Task ID: #a6ff8dd3-5eec-4efb-81bc-ffd467ecc6d6, 完全删除hasPersistedState方法; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
  // 已删除hasPersistedState方法

  // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:43:43 +08:00; Reason: Shrimp Task ID: #a6ff8dd3-5eec-4efb-81bc-ffd467ecc6d6, 完全删除cleanupExpiredStates方法; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
  // 已删除cleanupExpiredStates方法

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

    // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:43:43 +08:00; Reason: Shrimp Task ID: #a6ff8dd3-5eec-4efb-81bc-ffd467ecc6d6, 移除保存状态调用; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
    // 移除了保存状态的调用
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

    // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:43:43 +08:00; Reason: Shrimp Task ID: #a6ff8dd3-5eec-4efb-81bc-ffd467ecc6d6, 移除持久化状态清理调用; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
    // 移除了持久化状态清理相关代码

    // 清理状态历史
    this.stateHistory.length = 0

    // 重置状态
    this.currentPhase = GAME_PHASES.WAITING
    this.turn = 0

    console.log('[StateManager] 状态管理器清理完成')
  }

  // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:43:43 +08:00; Reason: Shrimp Task ID: #a6ff8dd3-5eec-4efb-81bc-ffd467ecc6d6, 完全删除restoreGameState方法; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
  // 已删除restoreGameState方法

  // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:43:43 +08:00; Reason: Shrimp Task ID: #a6ff8dd3-5eec-4efb-81bc-ffd467ecc6d6, 完全删除getPersistenceConfig方法; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
  // 已删除getPersistenceConfig方法

  // {{CHENGQI: Action: Removed; Timestamp: 2025-06-22 18:43:43 +08:00; Reason: Shrimp Task ID: #a6ff8dd3-5eec-4efb-81bc-ffd467ecc6d6, 完全删除setPersistenceEnabled方法; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
  // 已删除setPersistenceEnabled方法

  /**
   * 更新当前阶段
   * @private
   * @param {GameState} state 当前状态
   *
   * {{CHENGQI: Action: Modified; Timestamp: 2025-06-19 20:25:15 +08:00; Reason: Shrimp Task ID: #0620a86e-5d49-417f-a654-9b137ed6dd3a, 添加新阶段状态类支持; Principle_Applied: SOLID-OCP-OpenClosedPrinciple;}}
   */
  updateCurrentPhase (state) {
    if (!state) return

    const stateName = state.getName()

    // 根据状态名称映射到游戏阶段
    switch (stateName) {
      case 'NightState':
      case 'NightPhaseController': // 新增：支持阶段化夜晚状态控制器
        this.currentPhase = GAME_PHASES.NIGHT
        break
      // 阶段化夜晚状态支持
      case 'InformationPhaseState':
      case 'EliminationPhaseState':
      case 'InterventionPhaseState':
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
