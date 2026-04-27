/**
 * @file GameController.js
 * @description 游戏控制器，管理游戏和大厅的生命周期
 * @module controllers/GameController
 *
 * @input GameConfig, Player, Game, StateMachine, VictoryChecker
 * @output GameController - 游戏控制器类
 * @pos 控制器层 - 游戏/大厅生命周期管理
 *
 * @dependencies
 * - ../utils/GameConfig.js - 游戏配置
 * - ../models/Player.js - 玩家实体
 * - ../models/Game.js - 游戏聚合根
 * - ../models/StateMachine.js - 状态机
 * - ../models/VictoryChecker.js - 胜利检查器
 */
import GameConfig from '../utils/GameConfig.js'
import { Player } from '../models/Player.js'
import { Game } from '../models/Game.js'
import { StateMachine } from '../models/StateMachine.js'
import { VictoryChecker } from '../models/VictoryChecker.js'

export class GameController {
  static games = new Map() // groupId -> Game
  static lobbies = new Map() // groupId -> { players, gameConfig, friendReload, timeoutTimer, botRef }
  static MAX_GAMES = 100
  static _cleanupTimer = null
  static GAME_TTL = 4 * 60 * 60 * 1000 // 4小时
  static CLEANUP_TICK = 5 * 60 * 1000 // 5分钟

  static getGame (groupId) {
    return this.games.get(groupId) || null
  }

  /**
   * 通过玩家ID查找其所在的游戏实例
   * 用于私聊消息场景（e.group_id 不可用时的回退查找）
   * @param {string|number} userId - 玩家ID
   * @returns {Game|null}
   */
  static getGameByPlayer (userId) {
    if (!userId) return null
    for (const game of this.games.values()) {
      if (game.hasPlayer(userId)) return game
    }
    return null
  }

  static hasGame (groupId) {
    return this.games.has(groupId)
  }

  static getLobby (groupId) {
    return this.lobbies.get(groupId) || null
  }

  static hasLobby (groupId) {
    return this.lobbies.has(groupId)
  }

  static createGame (e) {
    const groupId = e.group_id

    if (this.games.size + this.lobbies.size >= this.MAX_GAMES) {
      e.reply('服务器游戏数已达上限，请稍后再试')
      return false
    }

    if (this.hasGame(groupId) || this.hasLobby(groupId)) {
      e.reply('当前群已有游戏或大厅进行中')
      return false
    }

    const lobby = { players: [], gameConfig: GameConfig, friendReload: false }
    this.lobbies.set(groupId, lobby)

    const creator = Player.fromEvent(e, { isCreator: true })
    lobby.players.push(creator)

    e.reply(`游戏大厅创建成功，${creator.name} 已自动加入游戏，其他玩家请输入 #加入狼人杀 参与`)
    return true
  }

  static joinGame (e) {
    const groupId = e.group_id

    if (this.hasGame(groupId)) {
      e.reply('游戏已经开始，无法加入')
      return false
    }

    const lobby = this.getLobby(groupId)
    if (!lobby) {
      e.reply('当前没有开放的游戏大厅，请先 #创建狼人杀')
      return false
    }

    if (lobby.players.some(p => p.id === e.user_id)) {
      e.reply('你已经在游戏中了')
      return false
    }

    const maxPlayers = lobby.gameConfig?.game?.maxPlayers
    if (Number.isFinite(maxPlayers) && lobby.players.length >= maxPlayers) {
      e.reply(`游戏人数已达上限${maxPlayers}人`)
      return false
    }

    const player = Player.fromEvent(e)
    lobby.players.push(player)

    const minPlayers = lobby.gameConfig?.game?.minPlayers || 6
    const needed = minPlayers - lobby.players.length
    const hint = needed > 0
      ? `\n还需 ${needed} 人才能开始游戏`
      : '\n人数已满足，可以开始游戏了！'
    e.reply(`${player.name} 加入成功，当前人数：${lobby.players.length}${hint}`)
    return true
  }

  static async startGame (e) {
    const groupId = e.group_id

    if (this.hasGame(groupId)) {
      e.reply('当前群已有进行中的游戏')
      return false
    }

    const lobby = this.getLobby(groupId)
    if (!lobby) {
      e.reply('当前没有开放的游戏大厅，请先 #创建狼人杀')
      return false
    }

    // 仅创建者或主人可开始游戏
    const creator = lobby.players?.find(p => p.isCreator)
    const triggerUserId = String(e.user_id)
    const isCreator = creator && String(creator.id) === triggerUserId
    if (!isCreator && !e.isMaster) {
      e.reply(`只有创建者${creator ? ` ${creator.name} ` : ''}或主人可以开始游戏`)
      return false
    }

    // 好友状态预检测
    const friendCheck = await this._checkFriendStatus(e, lobby)
    if (!friendCheck.allFriends) {
      const names = friendCheck.nonFriends.map(p => `@${p.name}`).join(' ')
      e.reply(`检测到以下玩家尚未添加机器人为好友：\n${names}\n\n请添加机器人好友后重新输入 #开始狼人杀`)
      this._setLobbyTimeout(groupId, lobby, e)
      return false
    }

    try {
      const game = new Game({
        e,
        config: lobby.gameConfig,
        players: lobby.players,
        stateMachine: new StateMachine(),
        victoryChecker: new VictoryChecker(),
        groupId
      })

      const ok = await game.start()
      if (!ok) return false

      this.games.set(groupId, game)
      this._startCleanupTimer()
      this._cleanupLobby(groupId)
      e.reply('游戏开始!')
      return true
    } catch (error) {
      console.error('[GameController] startGame failed:', error)
      e.reply('开始游戏失败，请重新创建大厅再试')
      this._cleanupLobby(groupId)
      return false
    }
  }

  static endGame (e) {
    const groupId = e.group_id

    const game = this.getGame(groupId)
    if (game && typeof game.cleanup === 'function') {
      try {
        game.cleanup()
      } catch (err) {
        console.warn('[GameController] cleanup failed:', err)
      }
    }

    this.games.delete(groupId)
    this._cleanupLobby(groupId)
    e.reply('游戏已结束')
    return true
  }

  // ==================== 好友检测 ====================

  /**
   * 检查大厅所有玩家的好友状态
   * 通过 bot.fl (好友列表缓存) 判断，非 ICQQ 适配器自动跳过
   */
  static async _checkFriendStatus (e, lobby) {
    // 适配器不支持好友列表时直接放行
    if (!e.bot?.fl || typeof e.bot.fl.has !== 'function') {
      return { allFriends: true, nonFriends: [] }
    }

    // 上次检测到非好友，先刷新缓存再重检
    if (lobby.friendReload && typeof e.bot.reloadFriendList === 'function') {
      try {
        await e.bot.reloadFriendList()
      } catch (err) {
        console.warn('[GameController] reloadFriendList failed:', err)
      }
      lobby.friendReload = false
    }

    const nonFriends = []
    for (const player of lobby.players) {
      if (!e.bot.fl.has(parseInt(player.id))) {
        nonFriends.push(player)
      }
    }

    // 标记下次检查需刷新缓存
    if (nonFriends.length > 0) {
      lobby.friendReload = true
    }

    return { allFriends: nonFriends.length === 0, nonFriends }
  }

  // ==================== 大厅超时管理 ====================

  /**
   * 设置大厅超时自动解散 (10 分钟)
   */
  static _setLobbyTimeout (groupId, lobby, e) {
    if (lobby.timeoutTimer) {
      clearTimeout(lobby.timeoutTimer)
    }

    lobby.botRef = e.bot

    lobby.timeoutTimer = setTimeout(async () => {
      if (!this.lobbies.has(groupId)) return
      try {
        const group = lobby.botRef?.pickGroup?.(groupId)
        if (group) {
          await group.sendMsg('游戏大厅因10分钟无活动自动解散，如需重新开始请输入 #创建狼人杀')
        }
      } catch (err) {
        console.error('[GameController] 超时通知失败:', err)
      }
      this._cleanupLobby(groupId)
    }, 10 * 60 * 1000)
  }

  /**
   * 清理大厅，包括超时定时器
   */
  static _cleanupLobby (groupId) {
    const lobby = this.lobbies.get(groupId)
    if (lobby?.timeoutTimer) {
      clearTimeout(lobby.timeoutTimer)
      lobby.timeoutTimer = null
    }
    this.lobbies.delete(groupId)
  }

  // ==================== 自动清理 ====================

  static _startCleanupTimer () {
    if (this._cleanupTimer) return
    this._cleanupTimer = setInterval(() => this._performAutoCleanup(), this.CLEANUP_TICK)
    if (this._cleanupTimer.unref) this._cleanupTimer.unref()
  }

  static async _performAutoCleanup () {
    const now = Date.now()
    for (const [groupId, game] of this.games) {
      if (!game.startTime || (now - game.startTime) < this.GAME_TTL) continue

      try {
        await game.e?.reply?.('游戏因超时（4小时无活动）自动结束')
      } catch (err) {
        console.warn('[GameController] auto-cleanup notify failed for group', groupId, err)
      }

      try {
        if (typeof game.cleanup === 'function') game.cleanup()
      } catch (err) {
        console.warn('[GameController] auto-cleanup cleanup failed for group', groupId, err)
      }

      this.games.delete(groupId)
    }
  }

  // ==================== 统计与诊断 ====================

  static getStats () {
    return {
      activeGames: this.games.size,
      activeLobbies: this.lobbies.size,
      totalPlayers: Array.from(this.games.values()).reduce((sum, g) => sum + (g.getPlayerCount?.() || 0), 0),
      cleanupTimerActive: this._cleanupTimer !== null
    }
  }

  static getOldestGameAge () {
    const now = Date.now()
    let oldest = 0
    for (const game of this.games.values()) {
      if (game.startTime) {
        const age = now - game.startTime
        if (age > oldest) oldest = age
      }
    }
    return oldest
  }

  // ==================== 优雅关闭 ====================

  static async gracefulShutdown () {
    // 停止清理定时器
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer)
      this._cleanupTimer = null
    }

    // 清理所有大厅定时器
    for (const [groupId, lobby] of this.lobbies) {
      if (lobby.timeoutTimer) {
        clearTimeout(lobby.timeoutTimer)
      }
    }

    // 清理所有游戏
    for (const [groupId, game] of this.games) {
      try {
        await game.e?.reply?.('服务器即将关闭，游戏被迫结束')
        if (typeof game.cleanup === 'function') game.cleanup()
      } catch (err) {
        console.warn('[GameController] gracefulShutdown cleanup failed for group', groupId, err)
      }
    }

    this.games.clear()
    this.lobbies.clear()
  }
}

