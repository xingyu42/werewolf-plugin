/**
 * @file Game.js
 * @description 游戏聚合根，管理玩家、状态机、胜利检查
 * @module models/Game
 *
 * @input VictoryChecker, RoleFactory, NightPhaseController, Constants, RoleConfigurator, GameError
 * @output Game - 游戏聚合根类
 * @pos 模型层 - 游戏聚合根，核心业务逻辑
 *
 * @dependencies
 * - ./VictoryChecker.js - 胜利条件检查
 * - ./roles/RoleFactory.js - 角色工厂
 * - ./states/NightPhaseController.js - 夜晚控制器
 * - ./Constants.js - 游戏常量
 * - ../utils/configurators/RoleConfigurator.js - 角色配置器
 * - ../utils/GameError.js - 游戏错误类
 *
 * Notes:
 * - Keeps core responsibilities: player management, state machine coordination, victory checking.
 * - Sends user-facing notifications directly via `this.e.reply()`.
 * - Provides lightweight `notificationCenter` / `playerManager` facades for compatibility with existing states.
 */
import { VictoryChecker } from './VictoryChecker.js'
import { RoleFactory } from './roles/RoleFactory.js'
import { NightPhaseController } from './states/NightPhaseController.js'
import { GAME_PHASES, ROLE_NAMES_CN } from './Constants.js'

import { RoleConfigurator } from '../utils/configurators/RoleConfigurator.js'
import { GameError } from '../utils/GameError.js'

function createNotificationFacade (e) {
  return {
    async sendMessage (type, target, content) {
      try {
        if (type === 'group') {
          await e.reply(content)
          return true
        }
        if (type === 'private' && target) {
          await e.bot.pickFriend(target).sendMsg(content)
          return true
        }
        return false
      } catch (err) {
        console.error('[Game.notificationCenterFacade] sendMessage failed:', err)
        return false
      }
    },
    async sendPrivateMessage (playerId, content) {
      return await this.sendMessage('private', playerId, content)
    },
    async handleError (error) {
      try {
        const msg = error instanceof Error ? error.message : String(error)
        await e.reply(`[游戏错误] ${msg}`)
      } catch (err) {
        console.error('[Game.notificationCenterFacade] handleError failed:', err)
      }
    },
    cleanup () {}
  }
}

export class Game {
  constructor ({ e, config, players, stateMachine, victoryChecker, groupId }) {
    this.id = groupId
    this.e = e
    this.config = config

    this._isCleanedUp = false
    this.startTime = Date.now()
    this.eventErrors = []

    // Player data
    this._players = new Map() // playerId -> Player
    this.roles = new Map() // playerId -> Role instance
    this.playerNumberMap = new Map() // gameNumber -> playerId
    this._nextPlayerNumber = 1

    // Compatibility facades for existing states (do not import NotificationCenter)
    this.notificationCenter = createNotificationFacade(e)
    this.playerManager = {
      getPlayerById: (playerId) => this.getPlayerById(playerId),
      getAllPlayers: () => this.getAllPlayers(),
      roles: this.roles
    }

    // State machine
    this.stateMachine = stateMachine
    this.currentPhase = GAME_PHASES.WAITING
    this.turn = 0
    // Day-start coordination flags (kept on Game so they survive intermediate states like LastWords/SheriffElect)
    this._dayStartPending = false
    this._dayStartDeathsAnnounced = false
    this._firstNightLastWordsHandled = false
    this._firstDaySheriffElectionHandled = false
    this.stateHistory = []
    this.currentState = null // compatibility alias used by some roles

    if (this.stateMachine) {
      this.stateMachine.setContext(this)
    }

    // Initial players
    if (players) {
      if (players instanceof Map) {
        for (const player of players.values()) this.addPlayer(player)
      } else if (Array.isArray(players)) {
        for (const player of players) this.addPlayer(player)
      }
    }

    this.victoryChecker = victoryChecker || new VictoryChecker()
  }

  // ==================== Player Management ====================

  addPlayer (player) {
    if (!player || !player.id) throw new GameError('Invalid player object', 'E1100')
    if (this._players.has(player.id)) throw new GameError('该玩家已经在游戏中', 'E1103')

    player.gameNumber = this._nextPlayerNumber++
    this.playerNumberMap.set(player.gameNumber, player.id)
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
    const playerId = this.playerNumberMap.get(Number(gameNumber))
    return playerId ? this._players.get(playerId) : null
  }

  getPlayerIdByNumber (gameNumber) {
    const player = this.getPlayerByNumber(gameNumber)
    return player ? player.id : null
  }

  getPlayerNumber (playerId) {
    const player = this.getPlayerById(playerId)
    return player ? player.gameNumber : null
  }

  shuffle (arr) {
    if (!Array.isArray(arr)) return []
    const result = [...arr]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  get sheriff () {
    return this.getAlivePlayers().find(p => p.isSheriff) || null
  }

  getAllPlayers () {
    return this._players
  }

  getPlayerCount () {
    return this._players.size
  }

  /**
   * Get alive players.
   * - default: returns `Player[]`
   * - with `includeRole`: returns `{ player, role }[]`
   * Supports filters: `roleType`, `campType`
   */
  getAlivePlayers (options = {}) {
    const { roleType = null, campType = null, includeRole = false } = options

    const result = []
    for (const player of this._players.values()) {
      if (!player.isAlive) continue

      if (campType) {
        const playerCamp = RoleFactory.getRoleCamp(player.role)
        if (playerCamp !== campType) continue
      }

      const role = this.getPlayerRole(player.id)
      if (roleType) {
        if (!role || role.constructor.name !== roleType) continue
      }

      if (includeRole) result.push({ player, role })
      else result.push(player)
    }

    return result
  }

  getAlivePlayerCount () {
    return this.getAlivePlayers().length
  }

  get players () {
    return this._players
  }

  getPlayerRole (playerId) {
    return this.roles.get(playerId) || null
  }

  // ==================== Role Initialization ====================

  async initializePlayerRoles (roleNames) {
    if (!Array.isArray(roleNames) || roleNames.length === 0) {
      throw new GameError('No roles provided for initialization', 'E1104')
    }

    const players = Array.from(this._players.values())
    if (players.length !== roleNames.length) {
      throw new GameError(`Player count (${players.length}) does not match role count (${roleNames.length})`, 'E1104')
    }

    // shuffle
    const shuffled = this.shuffle(roleNames)

    this.roles.clear()
    const notifyPromises = []
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      const roleName = shuffled[i]

      player.role = roleName
      const roleInstance = RoleFactory.createRole(roleName, this, player, this.e)

      // Ensure `getCamp()` is synchronous for downstream code (stats, etc.).
      if (roleInstance?.getCamp?.constructor?.name === 'AsyncFunction') {
        roleInstance.getCamp = () => RoleFactory.getRoleCamp(roleName)
      }

      this.roles.set(player.id, roleInstance)

      // 私聊通知玩家角色信息
      const roleNameCN = ROLE_NAMES_CN[roleName] || roleName
      const msg = `你的游戏编号是：${player.gameNumber}号\n你的身份是：${roleNameCN}`
      notifyPromises.push(
        this.notificationCenter.sendPrivateMessage(player.id, msg)
      )
    }

    // Best-effort 发送，不阻塞游戏开始流程
    Promise.allSettled(notifyPromises).catch(err => {
      console.warn('[Game] role notification failed:', err)
    })
  }

  // ==================== Game Flow ====================

  getConfig () {
    return this.config
  }

  async start () {
    const playerCount = this.getPlayerCount()
    const minPlayers = this.config?.game?.minPlayers

    if (Number.isFinite(minPlayers) && playerCount < minPlayers) {
      await this.e.reply(`游戏人数不足，无法开始（需要 ${minPlayers} 人，当前 ${playerCount} 人）。`)
      return false
    }

    await this.initPlayers()
    await this.initState()
    return true
  }

  async initPlayers () {
    const playerCount = this.getPlayerCount()
    const roles = RoleConfigurator.generate(playerCount)
    await this.initializePlayerRoles(roles)
  }

  async initState () {
    await this.initializeState()
  }

  async initializeState () {
    try {
      const initialState = new NightPhaseController(this)
      await this.changeState(initialState)
      this.currentPhase = GAME_PHASES.NIGHT
    } catch (error) {
      console.error('[Game] initializeState NightPhase failed:', error)
      try {
        const { DayState } = await import('./states/DayState.js')
        const fallback = new DayState(this)
        await this.changeState(fallback)
        this.currentPhase = GAME_PHASES.DAY_DISCUSSION
        await this.e.reply('夜晚阶段初始化异常，已回退至白天讨论阶段')
      } catch (fallbackError) {
        console.error('[Game] DayState fallback also failed:', fallbackError)
        await this.e.reply('初始化游戏状态失败，请重新创建游戏。')
        throw fallbackError
      }
    }
  }

  async changeState (newState) {
    if (!newState) throw new GameError('新状态不能为空', 'E1201')

    const oldState = this.getCurrentState()

    // Ensure legacy states can use `this.e`
    if (!newState.e) newState.e = this.e

    this.stateHistory.push({
      from: oldState ? oldState.getName() : 'none',
      to: newState.getName(),
      timestamp: Date.now(),
      turn: this.turn
    })

    await this.stateMachine.changeState(newState)

    // Compatibility aliases
    this.currentState = this.getCurrentState()

    this.updateCurrentPhase(newState)

    await this.e.reply(`游戏进入${newState.getName()}阶段`)
  }

  setStateTransitionContext (context) {
    if (this.stateMachine?.setStateTransitionContext) {
      this.stateMachine.setStateTransitionContext(context)
    }
  }

  getCurrentState () {
    return this.stateMachine ? this.stateMachine.getCurrentState() : null
  }

  // Some validators expect `game.state`
  get state () {
    return this.getCurrentState()
  }

  getCurrentPhase () {
    return this.currentPhase
  }

  getCurrentTurn () {
    return this.turn
  }

  async incrementTurn () {
    this.turn++
  }

  async startNewDay () {
    await this.incrementTurn()
    await this.e.reply(`=== 第${this.getCurrentTurn()}天 ===`)
  }

  isValidAction (player, action, data) {
    const currentState = this.getCurrentState()
    if (!currentState || typeof currentState.isValidAction !== 'function') return false
    return currentState.isValidAction(player, action, data)
  }

  async handleAction (player, action, data) {
    if (!player) throw new GameError('玩家参数不能为空', 'E1100')

    const currentState = this.getCurrentState()
    if (!currentState) throw new GameError('游戏尚未开始或已结束', 'E1201')

    if (typeof currentState.isValidAction === 'function') {
      const ok = currentState.isValidAction(player, action, data)
      if (!ok) throw new GameError('当前阶段不允许此操作', 'E1200')
    }

    await currentState.handleAction(player, action, data)
  }

  // ==================== Death / Victory ====================

  async handlePlayerDeath (player, reason) {
    if (!player) return false

    player.isAlive = false
    player.deathReason = reason

    // After a death, check victory
    await this.endGame()
    return true
  }

  async endGame () {
    const victoryResult = this.victoryChecker.checkVictory(this)
    if (!victoryResult?.gameOver) return false

    const alivePlayers = this.getAlivePlayers()
    const alivePlayersStr = alivePlayers.length > 0
      ? alivePlayers
        .map((p) => {
          const roleName = p.role ? (ROLE_NAMES_CN[p.role] || p.role) : '未知角色'
          const number = p.gameNumber ?? '?'
          return `${number}号 ${p.name}（${roleName}）`
        })
        .join('\n')
      : '无'

    await this.e.reply(
      `游戏结束！${victoryResult.winner}阵营胜利！\n${victoryResult.reason}\n存活玩家：\n${alivePlayersStr}`
    )

    // Update stats (best-effort)
    try {
      const { default: PlayerStats } = await import('../utils/PlayerStats.js')
      PlayerStats.updateStats(this, { winner: victoryResult.winner, reason: victoryResult.reason })
    } catch (err) {
      console.warn('[Game] failed to update PlayerStats:', err?.message || err)
    }

    setTimeout(() => this.cleanup(), 2000)
    return true
  }

  // ==================== Utilities ====================

  updateCurrentPhase (state) {
    if (!state) return

    const stateName = state.getName()
    switch (stateName) {
      case 'NightState':
      case 'NightPhaseController':
      case 'InformationPhaseState':
      case 'EliminationPhaseState':
      case 'InterventionPhaseState':
        this.currentPhase = GAME_PHASES.NIGHT
        break
      case 'DayState':
        this.currentPhase = GAME_PHASES.DAY_DISCUSSION
        break
      case 'VoteState':
        this.currentPhase = GAME_PHASES.DAY_VOTING
        break
      case 'SheriffElectState':
        this.currentPhase = GAME_PHASES.SHERIFF_ELECTION
        break
      default:
        break
    }
  }

  cleanup () {
    if (this._isCleanedUp) return
    this._isCleanedUp = true

    try {
      this.cleanupWolfRoleStatics()
      this.notificationCenter?.cleanup?.()
      this._players.clear()
      this.roles.clear()
      this.playerNumberMap.clear()
      this.eventErrors.length = 0
    } catch (error) {
      console.error('[Game] cleanup failed:', error)
    }
  }

  cleanupWolfRoleStatics () {
    try {
      import('./roles/WolfRole.js')
        .then(({ WolfRole }) => WolfRole?.cleanup?.())
        .catch((err) => console.warn('[Game] cleanupWolfRoleStatics failed:', err?.message || err))
    } catch (error) {
      console.warn('[Game] cleanupWolfRoleStatics failed:', error)
    }
  }

  getWolfVoteStats () {
    try {
      return import('./roles/WolfRole.js')
        .then(({ WolfRole }) => (WolfRole?.getStats ? WolfRole.getStats() : { voteCount: 0, hasKillTarget: false }))
        .catch(() => ({ voteCount: 0, hasKillTarget: false }))
    } catch (error) {
      return { voteCount: 0, hasKillTarget: false }
    }
  }

  getResourceStats () {
    return {
      playerCount: this.getPlayerCount(),
      roleCount: this.roles.size,
      eventErrorCount: this.eventErrors.length,
      currentPhase: this.getCurrentPhase(),
      currentTurn: this.getCurrentTurn()
    }
  }

  getStateHistory () {
    return [...this.stateHistory]
  }

  canEndCurrentState () {
    const currentState = this.getCurrentState()
    if (!currentState) return false
    if (typeof currentState.canEnd === 'function') return currentState.canEnd()
    return true
  }

  async forceEndCurrentState () {
    const currentState = this.getCurrentState()
    if (!currentState) return
    if (typeof currentState.onTimeout === 'function') await currentState.onTimeout()
  }
}
