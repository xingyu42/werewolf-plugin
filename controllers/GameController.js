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
  static lobbies = new Map() // groupId -> { players: Player[], gameConfig }

  static getGame (groupId) {
    return this.games.get(groupId) || null
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

    if (this.hasGame(groupId) || this.hasLobby(groupId)) {
      e.reply('当前群已有游戏或大厅进行中')
      return false
    }

    const lobby = { players: [], gameConfig: GameConfig }
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

    e.reply(`${player.name} 加入成功，当前人数：${lobby.players.length}`)
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
      this.lobbies.delete(groupId)
      e.reply('游戏开始!')
      return true
    } catch (error) {
      console.error('[GameController] startGame failed:', error)
      e.reply('开始游戏失败，请重新创建大厅再试')
      this.lobbies.delete(groupId)
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
    this.lobbies.delete(groupId)
    e.reply('游戏已结束')
    return true
  }
}

