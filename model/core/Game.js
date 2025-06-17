import { EventEmitter } from 'events'
import { VictoryChecker } from './VictoryChecker.js'
import { RoleConfigurator } from '../configurators/RoleConfigurator.js'
import { GameEventHandler } from './GameEventHandler.js'
import { PlayerManager } from '../managers/PlayerManager.js'
import { StateManager } from '../managers/StateManager.js'

/**
 * 游戏核心类 - 重构后的核心协调器
 * 负责协调各个管理器，保持游戏的整体流程控制
 */
export class Game extends EventEmitter {
  constructor ({ e, config, players, stateMachine, playerQueryService, victoryChecker, eventHandler, groupId }) {
    super()

    // 设置游戏ID，优先使用传入的groupId，否则使用时间戳+随机数
    this.id = groupId
    this.e = e // 保存 e 对象引用，供角色类使用
    this.config = config
    this.eventErrors = []
    
    // 清理状态标志，防止重复清理
    this._isCleanedUp = false

    // 初始化管理器
    this.playerManager = new PlayerManager(this)
    this.stateManager = new StateManager(this, stateMachine)

    // 如果传入了初始玩家，添加到玩家管理器
    if (players) {
      if (players instanceof Map) {
        for (const player of players.values()) {
          this.playerManager.addPlayer(player)
        }
      } else if (Array.isArray(players)) {
        for (const player of players) {
          this.playerManager.addPlayer(player)
        }
      }
    }

    // 保留原有的服务（暂时保持兼容性）
    this.playerQueryService = playerQueryService
    if (this.playerQueryService) {
      this.playerQueryService.setContext(
        this.playerManager.getAllPlayers(),
        this.playerManager.roles,
        this.playerManager.playerNumberMap,
        this.playerManager._cacheSystem
      )
    }

    this.eventHandler = eventHandler || new GameEventHandler(this, e)

    // 如果传入的eventHandler没有设置game引用，现在设置
    if (this.eventHandler && !this.eventHandler.game) {
      this.eventHandler.setGame(this)
    }

    // 胜利条件检查器
    this.victoryChecker = victoryChecker || new VictoryChecker()
  }

  // 委派给PlayerManager的方法
  addPlayer (player) {
    return this.playerManager.addPlayer(player)
  }

  hasPlayer (playerId) {
    return this.playerManager.hasPlayer(playerId)
  }

  getPlayerById (playerId) {
    return this.playerManager.getPlayer(playerId)
  }

  getPlayerByNumber (gameNumber) {
    return this.playerManager.getPlayerByNumber(gameNumber)
  }

  getAlivePlayers (options) {
    return this.playerManager.getAlivePlayers(options)
  }

  // 获取玩家集合 - 保持向后兼容性
  get players () {
    return this.playerManager.getAllPlayers()
  }

  // 初始化游戏
  async init (config) {
    this.config = config
    await this.initPlayers()
    this.initState()
  }

  // 初始化玩家 - 委派给PlayerManager
  async initPlayers () {
    const playerCount = this.playerManager.getPlayerCount()

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

    await this.playerManager.initializePlayerRoles(roles)
  }

  // 初始化游戏状态 - 委派给StateManager
  initState () {
    this.stateManager.initializeState()
  }

  // 委派给StateManager的方法
  async changeState (newState) {
    await this.stateManager.changeState(newState)
  }

  getCurrentState () {
    return this.stateManager.getCurrentState()
  }

  getCurrentPhase () {
    return this.stateManager.getCurrentPhase()
  }

  getCurrentTurn () {
    return this.stateManager.getCurrentTurn()
  }

  // 处理玩家行为 - 委派给StateManager
  async handleAction (player, action, target) {
    await this.stateManager.handleAction(player, action, target)
  }

  // 检查行为是否有效 - 委派给StateManager
  isValidAction (player, action) {
    return this.stateManager.isValidAction(player, action)
  }

  // 结束游戏
  async endGame () {
    // 使用胜利条件检查器检查游戏是否结束
    const victoryResult = this.victoryChecker.checkVictory(this)

    // 如果游戏结束，发出游戏结束事件
    if (victoryResult.gameOver) {
      const alivePlayersStr = this.getAlivePlayers({ showRole: true, showStatus: true }).map((p) => p.getDisplayInfo()).join('\n')

      this.emit('gameEnd', {
        winner: victoryResult.winner,
        reason: victoryResult.reason,
        alivePlayers: alivePlayersStr
      })

      // 游戏结束后进行资源清理
      setTimeout(() => {
        this.cleanup()
      }, 2000) // 延迟2秒清理，确保所有事件处理完成

      return true
    }

    return false
  }

  async startNewDay () {
    this.stateManager.incrementTurn()
    // 发送新的一天开始的消息，使用事件替代直接通信
    this.emit('newDay', { turn: this.stateManager.getCurrentTurn() })
  }

  // 根据游戏内编号获取玩家ID - 保持兼容性
  getPlayerIdByNumber (gameNumber) {
    const player = this.playerManager.getPlayerByNumber(gameNumber)
    return player ? player.id : null
  }

  // 获取配置
  getConfig () {
    return this.config
  }

  // 开始游戏
  async start () {
    const playerCount = this.playerManager.getPlayerCount()
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
   * 统一处理玩家死亡 - 委派给PlayerManager
   */
  async handlePlayerDeath (player, reason) {
    const result = await this.playerManager.handlePlayerDeath(player, reason)

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
    
    // 发出复活事件，供其他组件监听
    this.emit('playerRevived', { player })
    return true
  }

  /**
   * 批量清除所有玩家的保护状态
   */
  clearAllProtectedStatus () {
    const players = this.playerManager.getAllPlayers()
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

      // 清理事件监听器
      if (typeof this.removeAllListeners === 'function') {
        this.removeAllListeners()
      }

      // 清理GameEventHandler
      if (this.eventHandler && typeof this.eventHandler.cleanup === 'function') {
        this.eventHandler.cleanup()
      }

      // 清理管理器
      if (this.playerManager) {
        this.playerManager.cleanup()
      }

      if (this.stateManager) {
        this.stateManager.cleanup()
      }

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
      import('../roles/WolfRole.js').then(({ WolfRole }) => {
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
      return import('../roles/WolfRole.js').then(({ WolfRole }) => {
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
      playerCount: this.playerManager ? this.playerManager.getPlayerCount() : 0,
      roleCount: this.playerManager ? this.playerManager.roles.size : 0,
      eventErrorCount: this.eventErrors ? this.eventErrors.length : 0,
      hasEventHandler: !!this.eventHandler,
      listenerCount: this.listenerCount ? this.listenerCount() : 0,
      currentPhase: this.stateManager ? this.stateManager.getCurrentPhase() : 'unknown',
      currentTurn: this.stateManager ? this.stateManager.getCurrentTurn() : 0
    }
  }
}
