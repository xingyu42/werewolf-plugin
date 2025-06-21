/**
 * 状态机配置 - 定义游戏中所有合法的状态转换路径
 * 此文件使复杂的游戏流程变得清晰、可预测、易于维护
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
  // 夜晚状态可以转换到白天状态
  [GameStateType.NIGHT]: {
    [GameStateType.DAY]: {
      description: '夜晚结束，进入白天',
      condition: (game) => true // 始终允许此转换
    }
  },
  // 允许 NightPhaseController 作为夜晚状态的别名进行状态转换
  NightPhaseController: {
    [GameStateType.DAY]: {
      description: '夜晚阶段控制器结束，进入白天',
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
    [GameStateType.SHERIFF_ELECT]: {
      description: '首日特殊流程，进入警长竞选',
      condition: (game) => game.turn === 1 // 仅在第一天允许
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
      condition: (game, deadPlayer) => !deadPlayer.isSheriff // 死者不是警长
    },
    [GameStateType.SHERIFF_TRANSFER]: {
      description: '死者是警长，需要移交警徽',
      condition: (game, deadPlayer) => deadPlayer.isSheriff // 死者是警长
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
      // In a real scenario, you'd probably want to emit an error or log it.
      console.error('StateMachine: newState is undefined')
      return
    }

    if (this._changingState) {
      console.warn('StateMachine: State change blocked, already changing state.')
      return
    }

    if (this.currentState) {
      const fromState = this.currentState.constructor.name
      const toState = newState.constructor.name

      const validationResult = isValidTransition(fromState, toState, this.game, this.stateTransitionContext)

      if (!validationResult.allowed) {
        console.error(`StateMachine: Invalid state transition from ${fromState} to ${toState}. Reason: ${validationResult.reason}`)
        // Optionally, emit an event or throw an error
        return
      }

      this.recordStateHistory(this.currentState)
    }

    this._changingState = true
    try {
      if (this.currentState) {
        await this.currentState.onExit()
      }

      this.currentState = newState
      // The new state needs a reference to the game context.
      // This assumes states have a setContext or similar method, or are constructed with it.
      if (typeof this.currentState.setContext === 'function') {
        this.currentState.setContext(this.game)
      }
      await this.currentState.onEnter()
    } catch (err) {
      console.error('StateMachine: Error during state transition:', err)
    } finally {
      this._changingState = false
    }
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
