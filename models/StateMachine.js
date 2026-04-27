/**
 * @file StateMachine.js
 * @description 状态机配置，定义游戏中所有合法的状态转换路径
 * @module model/core/StateMachine
 *
 * @input 无
 * @output GameStateType, StateTransitions, StateMachine
 * @pos 核心层 - 状态机，管理游戏状态转换
 *
 * @dependencies 无
 */

// 游戏状态枚举
// {{CHENGQI: Action: Modified; Timestamp: 2025-06-21 13:43:14 +08:00; Reason: Shrimp Task ID: #e3f2f046-2904-468a-8913-56be7356be70, 更新NIGHT状态类型为NightPhaseController; Principle_Applied: SOLID-OCP-OpenClosedPrinciple;}}
export const GameStateType = {
  NIGHT: 'NightPhaseController',
  // 新增：阶段化夜晚状态类型
  INFORMATION_PHASE: 'InformationPhaseState',
  ELIMINATION_PHASE: 'EliminationPhaseState',
  INTERVENTION_PHASE: 'InterventionPhaseState',
  DAY: 'DayState',
  VOTE: 'VoteState',
  LAST_WORDS: 'LastWordsState',
  SHERIFF_ELECT: 'SheriffElectState',
  SHERIFF_TRANSFER: 'SheriffTransferState'
}

/**
 * 状态转换配置
 *
 * 每个状态都有一个对象，其中定义了它可以转换到的目标状态
 * 对于某些特殊情况，还可以定义条件检查函数
 */
export const StateTransitions = {
  // 夜晚状态可以转换到白天状态或夜晚子阶段
  [GameStateType.NIGHT]: {
    [GameStateType.INFORMATION_PHASE]: {
      description: '夜晚开始，进入信息收集阶段',
      condition: (game) => true
    },
    [GameStateType.ELIMINATION_PHASE]: {
      description: '夜晚阶段跳过信息收集，直接进入消除阶段',
      condition: (game) => true
    },
    [GameStateType.INTERVENTION_PHASE]: {
      description: '夜晚阶段跳过前置阶段，直接进入干预阶段',
      condition: (game) => true
    },
    [GameStateType.DAY]: {
      description: '夜晚结束，进入白天',
      condition: (game) => true // 始终允许此转换
    }
  },

  // 新增：阶段化夜晚状态转换规则
  // {{CHENGQI: Action: Added; Timestamp: 2025-06-19 20:27:45 +08:00; Reason: Shrimp Task ID: #0620a86e-5d49-417f-a654-9b137ed6dd3a, 添加阶段状态转换规则; Principle_Applied: SOLID-OCP-OpenClosedPrinciple;}}

  // 信息收集阶段可以转换到消除阶段或白天状态
  [GameStateType.INFORMATION_PHASE]: {
    [GameStateType.ELIMINATION_PHASE]: {
      description: '信息收集阶段结束，进入消除阶段',
      condition: (game) => true
    },
    [GameStateType.DAY]: {
      description: '信息收集阶段结束，直接进入白天（跳过后续阶段）',
      condition: (game) => true
    }
  },

  // 消除阶段可以转换到干预阶段或白天状态
  [GameStateType.ELIMINATION_PHASE]: {
    [GameStateType.INTERVENTION_PHASE]: {
      description: '消除阶段结束，进入干预阶段',
      condition: (game) => true
    },
    [GameStateType.DAY]: {
      description: '消除阶段结束，直接进入白天（跳过干预阶段）',
      condition: (game) => true
    }
  },

  // 干预阶段可以转换到白天状态
  [GameStateType.INTERVENTION_PHASE]: {
    [GameStateType.DAY]: {
      description: '干预阶段结束，进入白天',
      condition: (game) => true
    }
  },

  // 白天状态可以转换到投票状态
  [GameStateType.DAY]: {
    [GameStateType.VOTE]: {
      description: '白天讨论结束，进入投票',
      condition: (game) => true // 始终允许此转换
    },
    [GameStateType.LAST_WORDS]: {
      description: '首夜死亡玩家遗言流程',
      condition: (game) => game.turn === 0
    },
    [GameStateType.SHERIFF_ELECT]: {
      description: '首日特殊流程，进入警长竞选',
      condition: (game) => game.turn === 0 // 仅在第一天允许（首夜过渡到白天时）
    },
    [GameStateType.SHERIFF_TRANSFER]: {
      description: '白天发现警长死亡，进入警长移交',
      condition: (game) => true
    }
  },

  // 投票状态可以转换到遗言状态或夜晚状态
  [GameStateType.VOTE]: {
    [GameStateType.LAST_WORDS]: {
      description: '投票决定驱逐某人，进入遗言',
      condition: (game) => true // 始终允许此转换
    },
    [GameStateType.NIGHT]: {
      description: '平票无人驱逐，直接进入夜晚',
      condition: (game) => true // 始终允许此转换
    }
  },

  // 遗言状态转换到夜晚状态或警长移交状态
  [GameStateType.LAST_WORDS]: {
    [GameStateType.NIGHT]: {
      description: '遗言结束，进入夜晚',
      condition: (game, deadPlayer) => !deadPlayer?.isSheriff // 死者不是警长
    },
    [GameStateType.DAY]: {
      description: '首夜遗言结束，继续白天流程',
      condition: (game) => game.turn === 0
    },
    [GameStateType.SHERIFF_TRANSFER]: {
      description: '死者是警长，需要移交警徽',
      condition: (game, deadPlayer) => !!deadPlayer?.isSheriff // 死者是警长
    }
  },

  // 警长竞选状态转换到白天状态
  [GameStateType.SHERIFF_ELECT]: {
    [GameStateType.DAY]: {
      description: '警长选举结束，继续白天流程',
      condition: (game) => true // 始终允许此转换
    }
  },

  // 警长移交状态可以转换到任何状态（根据构造函数中的nextState决定）
  [GameStateType.SHERIFF_TRANSFER]: {
    [GameStateType.NIGHT]: {
      description: '警长移交结束，进入夜晚',
      condition: (game) => true // 始终允许此转换
    },
    [GameStateType.DAY]: {
      description: '警长移交结束，返回白天流程',
      condition: (game) => true // 始终允许此转换
    }
  }
}

/**
 * 检查状态转换是否合法
 * @param {string} fromState 源状态类名
 * @param {string} toState 目标状态类名
 * @param {Game} game 游戏实例
 * @param {Object} context 额外的上下文信息（如死亡的玩家）
 * @returns {Object} 包含是否允许转换和原因的对象
 */
export function isValidTransition (fromState, toState, game, context = {}) {
  // 获取源状态的可能转换
  const possibleTransitions = StateTransitions[fromState]

  // 如果没有为源状态定义转换，则不允许
  if (!possibleTransitions) {
    return {
      allowed: false,
      reason: `未定义从 ${fromState} 的任何转换`
    }
  }

  // 检查是否可以转换到目标状态
  const transition = possibleTransitions[toState]

  // 如果没有定义到目标状态的转换，则不允许
  if (!transition) {
    return {
      allowed: false,
      reason: `不允许从 ${fromState} 转换到 ${toState}`
    }
  }

  // 如果定义了条件函数，则检查条件
  if (transition.condition && typeof transition.condition === 'function') {
    const conditionMet = transition.condition(game, context.deadPlayer)

    if (!conditionMet) {
      return {
        allowed: false,
        reason: `条件不满足: ${transition.description}`
      }
    }
  }

  // 允许转换
  return {
    allowed: true,
    reason: transition.description
  }
}

export class StateMachine {
  constructor (initialState) {
    this.currentState = initialState
    this._changingState = false
    this._pendingState = null // 队列：onEnter 内触发的二次切换
    this.stateHistory = []
    this.maxHistoryLength = 50
    this.stateTransitionContext = {}
    this.game = null // To be set later
  }

  setContext (game) {
    this.game = game
  }

  async changeState (newState) {
    if (!newState) {
      console.error('StateMachine: newState is undefined')
      return false
    }

    // 如果正在切换中，队列化请求而非丢弃
    if (this._changingState) {
      this._pendingState = newState
      return true
    }

    if (this.currentState) {
      const fromState = this.currentState.constructor.name
      const toState = newState.constructor.name

      const validationResult = isValidTransition(fromState, toState, this.game, this.stateTransitionContext)

      if (!validationResult.allowed) {
        console.error(`StateMachine: Invalid state transition from ${fromState} to ${toState}. Reason: ${validationResult.reason}`)
        return false
      }

      this.recordStateHistory(this.currentState)
    }

    this._changingState = true
    try {
      if (this.currentState) {
        await this.currentState.onExit()
      }

      this.currentState = newState
      if (typeof this.currentState.setContext === 'function') {
        this.currentState.setContext(this.game)
      }
      await this.currentState.onEnter()
    } catch (err) {
      console.error('StateMachine: Error during state transition:', err)
    } finally {
      this._changingState = false
    }

    // 处理在 onEnter 期间排队的状态切换
    if (this._pendingState) {
      const pending = this._pendingState
      this._pendingState = null
      await this.changeState(pending)
    }

    return true
  }

  recordStateHistory (state) {
    if (!state) return

    const historyEntry = {
      stateType: state.constructor.name,
      timestamp: new Date(),
      turn: this.game ? this.game.turn : null // Access turn from game context
    }

    this.stateHistory.push(historyEntry)

    if (this.stateHistory.length > this.maxHistoryLength) {
      this.stateHistory.shift()
    }
  }

  setStateTransitionContext (context) {
    this.stateTransitionContext = context || {}
  }

  getCurrentState () {
    return this.currentState
  }
}
