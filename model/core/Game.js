import { VictoryChecker } from './VictoryChecker.js'
import { RoleConfigurator } from '../../utils/configurators/RoleConfigurator.js'
import { NotificationCenter } from './NotificationCenter.js'
import { GameError } from './GameError.js'
import { NightPhaseController } from '../strategies/states/NightPhaseController.js'
import { GAME_PHASES } from './Constants.js'

/**
 * 游戏核心类 - 重构后的核心协调器
 * 负责协调各个管理器，保持游戏的整体流程控制
 * 移除EventEmitter继承，使用NotificationCenter进行通知
 */
export class Game {
  constructor ({ e, config, players, stateMachine, playerQueryService, victoryChecker, eventHandler, groupId }) {
    // 移除 super() 调用

    // 设置游戏ID，优先使用传入的groupId，否则使用时间戳+随机数
    this.id = groupId
    this.e = e // 保存 e 对象引用，供角色类使用
    this.config = config
    this.eventErrors = []

    // 初始化通知中心替代GameEventHandler
    this.notificationCenter = new NotificationCenter(e)

    // 设置游戏引用，用于统计数据更新
    this.notificationCenter.game = this

    // 清理状态标志，防止重复清理
    this._isCleanedUp = false

    // PlayerManager 功能直接集成到 Game 类中
    this._players = new Map() // 玩家集合，key为playerId，value为Player对象
    this.roles = new Map() // 角色分配，key为playerId，value为角色名称
    this.playerNumberMap = new Map() // 玩家号码映射，key为gameNumber，value为playerId
    this._nextPlayerNumber = 1 // 下一个玩家号码
    this._cacheSystem = new Map() // 缓存系统

    // StateManager 属性整合到 Game 类中
    this.stateMachine = stateMachine
    this.currentPhase = GAME_PHASES.WAITING
    this.turn = 0
    this.stateHistory = [] // 状态历史记录

    // 设置状态机上下文
    if (this.stateMachine) {
      this.stateMachine.setContext(this)
    }

    // 如果传入了初始玩家，添加到玩家集合
    if (players) {
      if (players instanceof Map) {
        for (const player of players.values()) {
          this.addPlayer(player)
        }
      } else if (Array.isArray(players)) {
        for (const player of players) {
          this.addPlayer(player)
        }
      }
    }

    // 保留原有的服务（暂时保持兼容性）
    this.playerQueryService = playerQueryService
    if (this.playerQueryService) {
      this.playerQueryService.setContext(
        this.players,
        this.roles,
        this.playerNumberMap,
        this._cacheSystem
      )
    }

    // 移除 GameEventHandler，功能已迁移到 NotificationCenter
    // this.eventHandler = eventHandler || new GameEventHandler(this, e)

    // 胜利条件检查器
    this.victoryChecker = victoryChecker || new VictoryChecker()
  }

  // PlayerManager 功能直接实现
  addPlayer (player) {
    if (!player || !player.id) {
      throw new GameError('Invalid player object', 'INVALID_PLAYER')
    }

    if (this._players.has(player.id)) {
      throw new GameError(`Player ${player.id} already exists`, 'PLAYER_EXISTS')
    }

    // 分配游戏号码
    player.gameNumber = this._nextPlayerNumber++
    this.playerNumberMap.set(player.gameNumber, player.id)

    // 添加到玩家集合
    this._players.set(player.id, player)

    return player
  }

  hasPlayer (playerId) {
    return this._players.has(playerId)
  }

  getPlayerById (playerId) {
    return this._players.get(playerId)
  }

  getPlayerByNumber (gameNumber) {
    const playerId = this.playerNumberMap.get(gameNumber)
    return playerId ? this._players.get(playerId) : null
  }

  getAlivePlayers (options = {}) {
    const alivePlayers = new Map()
    for (const [id, player] of this._players) {
      if (player.isAlive) {
        alivePlayers.set(id, player)
      }
    }
    return alivePlayers
  }

  // 获取所有玩家
  getAllPlayers () {
    return this._players
  }

  // 获取玩家数量
  getPlayerCount () {
    return this._players.size
  }

  // 获取存活玩家数量
  getAlivePlayerCount () {
    return this.getAlivePlayers().size
  }

  // 初始化玩家角色
  async initializePlayerRoles (roles) {
    if (!roles || roles.length === 0) {
      throw new GameError('No roles provided for initialization', 'NO_ROLES')
    }

    const players = Array.from(this._players.values())
    if (players.length !== roles.length) {
      throw new GameError(`Player count (${players.length}) does not match role count (${roles.length})`, 'ROLE_PLAYER_MISMATCH')
    }

    // 随机分配角色
    const shuffledRoles = [...roles].sort(() => Math.random() - 0.5)

    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      const role = shuffledRoles[i]

      player.role = role
      this.roles.set(player.id, role)
    }
  }

  // 处理玩家死亡
  async _handlePlayerDeath (player, reason) {
    if (!player) {
      return false
    }

    // 设置玩家死亡状态
    player.isAlive = false
    player.deathReason = reason

    // 通知死亡事件
    this.notificationCenter.notify('playerDeath', {
      player,
      reason,
      gameId: this.id
    })

    return true
  }

  // 获取玩家集合 - 保持向后兼容性
  get players () {
    return this._players
  }

  // 初始化游戏
  async init (config) {
    this.config = config
    await this.initPlayers()
    this.initState()
  }

  // 初始化玩家
  async initPlayers () {
    const playerCount = this.getPlayerCount()

    let roles
    try {
      // 检查是否使用固定角色配置
      if (this.config.roles?.useFixedRoles && this.config.roles?.fixedRoles) {
        roles = this.config.roles.fixedRoles
        // 验证固定角色数量是否匹配
        if (roles.length !== playerCount) {
          console.warn(`固定角色配置数量(${roles.length})与玩家数量(${playerCount})不匹配，使用动态生成`)
          roles = RoleConfigurator.generate(playerCount)
        }
      } else {
        roles = RoleConfigurator.generate(playerCount)
      }
    } catch (error) {
      // 如果是GameError，使用ErrorHandler处理
      if (error.name === 'GameError' && this.eventHandler?.errorHandler) {
        const context = {
          gameId: this.id || 'unknown',
          playerCount,
          phase: 'initialization'
        }
        this.eventHandler.errorHandler.handle(error, context)
      }
      // 重新抛出错误，让上层调用者处理
      throw error
    }

    await this.initializePlayerRoles(roles)
  }

  // 初始化游戏状态
  async initState () {
    await this.initializeState()
  }

  /**
   * 初始化游戏状态
   * 设置游戏的初始状态
   */
  async initializeState () {
    try {
      console.log('[Game] 开始初始化游戏状态，使用阶段化夜晚状态控制器')

      // 切换到新的阶段化夜晚状态控制器
      const initialState = new NightPhaseController(this)
      await this.changeState(initialState)
      this.currentPhase = GAME_PHASES.NIGHT
      this.turn = 1

      console.log('[Game] 游戏状态初始化完成，进入阶段化夜晚流程')

      // 替换emit调用为notificationCenter
      await this.notificationCenter.notifyStateInitialized(
        'NightPhaseController',
        this.turn,
        this.currentPhase
      )
    } catch (error) {
      console.error('[Game] 初始化游戏状态失败:', error)

      // 尝试使用简化的夜晚状态回退机制（如果新控制器初始化失败）
      try {
        console.log('[Game] 尝试使用简化回退机制，跳过夜晚阶段')
        const { DayState } = await import('../action/DayState.js')
        const fallbackState = new DayState(this)
        await this.changeState(fallbackState)
        this.currentPhase = GAME_PHASES.DAY
        this.turn = 1

        console.log('[Game] 已回退到白天状态，跳过夜晚阶段')
        // 替换emit调用 - 回退通知不需要用户通知，仅记录日志
        console.log('[Game] 状态回退: DayState, 原始错误:', error.message)
      } catch (fallbackError) {
        console.error('[Game] 简化回退机制也失败:', fallbackError)
        // 替换emit调用为notificationCenter
        await this.notificationCenter.handleError(new GameError(
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

      console.log(`[Game] 状态转换: ${oldState?.getName() || 'none'} -> ${newState.getName()}`)

      // 替换emit调用为notificationCenter
      await this.notificationCenter.notifyStateChanged(
        oldState,
        newState,
        this.turn
      )

      // 移除了自动保存游戏状态的调用
    } catch (error) {
      console.error('[Game] 状态转换失败:', error)
      // 替换emit调用为notificationCenter
      await this.notificationCenter.handleError(new GameError(
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
      console.error('[Game] 验证行动有效性时出错:', error)
      return false
    }
  }

  /**
   * 处理玩家行为
   * @param {Player} player 玩家
   * @param {string} action 行动
   * @param {Player|null} target 目标玩家
   */
  async handleAction (player, action, target) {
    try {
      if (!player) {
        // 替换emit调用为notificationCenter
        await this.notificationCenter.handleError(new GameError(
          '玩家参数不能为空',
          'INVALID_PLAYER'
        ))
        return
      }

      const currentState = this.getCurrentState()
      if (!currentState) {
        // 替换emit调用为notificationCenter
        await this.notificationCenter.handleError(new GameError(
          '游戏状态错误: 当前没有活动状态',
          'NO_ACTIVE_STATE'
        ))
        return
      }

      // 委派给当前状态处理
      await currentState.handleAction(player, action, target)
    } catch (err) {
      console.error('[Game] 处理玩家行为时出错:', err)
      // 替换emit调用为notificationCenter
      await this.notificationCenter.handleError(new GameError(
        err.message,
        'ACTION_ERROR',
        { player, action, target }
      ))
    }
  }

  // 结束游戏
  async endGame () {
    // 使用胜利条件检查器检查游戏是否结束
    const victoryResult = this.victoryChecker.checkVictory(this)

    // 如果游戏结束，通过通知中心发送游戏结束通知
    if (victoryResult.gameOver) {
      const alivePlayersStr = this.getAlivePlayers({ showRole: true, showStatus: true }).map((p) => p.getDisplayInfo()).join('\n')

      // 替换：this.emit('gameEnd', {...})
      await this.notificationCenter.notifyGameEnd(
        victoryResult.winner,
        victoryResult.reason,
        alivePlayersStr
      )

      // 游戏结束后进行资源清理
      setTimeout(() => {
        this.cleanup()
      }, 2000) // 延迟2秒清理，确保所有事件处理完成

      return true
    }

    return false
  }

  async startNewDay () {
    await this.incrementTurn()
    // 替换：this.emit('newDay', { turn: this.getCurrentTurn() })
    await this.notificationCenter.notifyNewDay(this.getCurrentTurn())
  }

  /**
   * 增加回合数
   */
  async incrementTurn () {
    this.turn++
    console.log(`[Game] 回合数增加到: ${this.turn}`)

    // 替换emit调用为notificationCenter
    await this.notificationCenter.notifyNewTurn(this.turn, this.currentPhase)

    // 移除了保存状态的调用
  }

  // 根据游戏内编号获取玩家ID - 保持兼容性
  getPlayerIdByNumber (gameNumber) {
    const player = this.getPlayerByNumber(gameNumber)
    return player ? player.id : null
  }

  // 获取配置
  getConfig () {
    return this.config
  }

  // 开始游戏
  async start () {
    const playerCount = this.getPlayerCount()
    if (playerCount < this.config.minPlayers) {
      // 直接发送群消息，不再使用事件发射
      this.e.reply(`游戏人数不足，无法开始（需要 ${this.config.minPlayers} 人，当前 ${playerCount} 人）。`)
      return false
    }
    await this.initPlayers()
    this.initState()
    return true
  }

  /**
   * 统一处理玩家死亡
   */
  async handlePlayerDeath (player, reason) {
    const result = await this._handlePlayerDeath(player, reason)

    // 如果死亡处理成功，检查游戏是否结束
    if (result) {
      await this.endGame()
    }

    return result
  }

  /**
   * 统一设置玩家保护状态
   * @param {Object} player - 玩家对象
   * @param {boolean} status - 保护状态 (true=受保护, false=不受保护)
   */
  setProtectedStatus (player, status) {
    if (!player) {
      console.error('[Game] setProtectedStatus: 玩家对象为空')
      return false
    }

    player.protected = status
    console.debug(`[Game] 玩家 ${player.name} 保护状态设置为: ${status}`)
    return true
  }

  /**
   * 统一复活玩家
   * @param {Object} player - 要复活的玩家对象
   */
  revivePlayer (player) {
    if (!player) {
      console.error('[Game] revivePlayer: 玩家对象为空')
      return false
    }

    player.isAlive = true
    player.deathReason = null
    console.debug(`[Game] 玩家 ${player.name} 已复活`)

    // 移除：this.emit('playerRevived', { player })
    // 改为直接返回结果，让调用方决定后续处理
    return true
  }

  /**
   * 批量清除所有玩家的保护状态
   */
  clearAllProtectedStatus () {
    const players = this.getAllPlayers()
    let clearedCount = 0

    for (const player of players.values()) {
      if (player.protected) {
        player.protected = false
        clearedCount++
      }
    }

    console.debug(`[Game] 已清除 ${clearedCount} 个玩家的保护状态`)
    return clearedCount
  }

  /**
   * 清理游戏资源，防止内存泄漏
   */
  cleanup () {
    // 防止重复清理
    if (this._isCleanedUp) {
      console.log(`[Game] 游戏资源已清理过，跳过重复清理 (ID: ${this.id})`)
      return
    }

    console.log(`[Game] 开始清理游戏资源 (ID: ${this.id})`)
    this._isCleanedUp = true

    try {
      // 清理WolfRole静态属性，防止跨游戏污染
      this.cleanupWolfRoleStatics()

      // 移除：if (typeof this.removeAllListeners === 'function') { this.removeAllListeners() }

      // 清理NotificationCenter
      if (this.notificationCenter && typeof this.notificationCenter.cleanup === 'function') {
        this.notificationCenter.cleanup()
      }

      // 清理管理器
      // PlayerManager 功能已整合到 Game 类中，直接清理玩家数据
      this._players.clear()
      this.roles.clear()
      this.playerNumberMap.clear()
      this._cacheSystem.clear()

      // StateManager 功能已整合到 Game 类中，无需单独清理

      // 清理错误历史
      if (this.eventErrors) {
        this.eventErrors.length = 0
      }

      console.log(`[Game] 游戏资源清理完成 (ID: ${this.id})`)
    } catch (error) {
      console.error(`[Game] 清理游戏资源时发生错误 (ID: ${this.id}):`, error)
    }
  }

  /**
   * 清理WolfRole静态属性，防止跨游戏数据污染
   */
  cleanupWolfRoleStatics () {
    try {
      // 动态导入WolfRole并调用其cleanup方法
      import('../strategies/roles/WolfRole.js').then(({ WolfRole }) => {
        if (WolfRole && typeof WolfRole.cleanup === 'function') {
          WolfRole.cleanup()
        }
      }).catch(error => {
        console.warn('[Game] 清理WolfRole静态属性时发生错误:', error)
      })
    } catch (error) {
      console.warn('[Game] 无法清理WolfRole静态属性:', error)
    }
  }

  /**
   * 获取狼人投票统计 - 集中化管理
   */
  getWolfVoteStats () {
    try {
      // 动态导入WolfRole获取统计信息
      return import('../strategies/roles/WolfRole.js').then(({ WolfRole }) => {
        return WolfRole.getStats ? WolfRole.getStats() : { voteCount: 0, hasKillTarget: false }
      }).catch(() => ({ voteCount: 0, hasKillTarget: false }))
    } catch (error) {
      console.warn('[Game] 获取狼人投票统计失败:', error)
      return { voteCount: 0, hasKillTarget: false }
    }
  }

  /**
   * 获取游戏资源使用统计
   */
  getResourceStats () {
    return {
      playerCount: this.getPlayerCount(),
      roleCount: this.roles.size,
      eventErrorCount: this.eventErrors ? this.eventErrors.length : 0,
      hasEventHandler: !!this.eventHandler,
      listenerCount: this.listenerCount ? this.listenerCount() : 0,
      currentPhase: this.getCurrentPhase(),
      currentTurn: this.getCurrentTurn()
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

    console.log(`[Game] 强制结束状态: ${currentState.getName()}`)

    // 如果状态有onTimeout方法，则调用它
    if (typeof currentState.onTimeout === 'function') {
      await currentState.onTimeout()
    }
  }
}
