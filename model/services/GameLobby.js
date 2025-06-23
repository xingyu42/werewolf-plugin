import { Game } from '../core/Game.js'
import { GameRegistry } from './GameRegistry.js'
import { StateMachine } from '../core/StateMachine.js'
import { PlayerQueryService } from './PlayerQueryService.js'
import { VictoryChecker } from '../core/VictoryChecker.js'
// 移除 GameEventHandler 导入，功能已迁移到 NotificationCenter

export class GameLobby {
  constructor (gameConfig) {
    this.gameConfig = gameConfig
    this.players = []
  }

  // 检查玩家是否已加入
  hasPlayer (playerId) {
    return this.players.some((p) => p.id === playerId)
  }

  // 添加玩家
  addPlayer (playerInfo) {
    const playerCount = this.players.length
    const maxPlayers = this.gameConfig.game.maxPlayers // 从game配置中获取maxPlayers

    if (playerCount >= maxPlayers) {
      throw new Error(`游戏人数已达上限${maxPlayers}人`)
    }

    if (this.hasPlayer(playerInfo.id)) {
      throw new Error('该玩家已经在游戏中')
    }

    this.players.push(playerInfo)
    return this
  }

  // 移除玩家
  removePlayer (playerId) {
    const index = this.players.findIndex((p) => p.id === playerId)
    if (index !== -1) {
      this.players.splice(index, 1)
    }
    return this
  }

  // 设置玩家列表
  setPlayers (players) {
    const playerCount = players.length
    const minPlayers = this.gameConfig.game.minPlayers
    const maxPlayers = this.gameConfig.game.maxPlayers

    if (playerCount < minPlayers || playerCount > maxPlayers) {
      throw new Error(`玩家数量必须在${minPlayers}到${maxPlayers}之间`)
    }
    this.players = players
    return this
  }

  // 获取玩家列表
  getPlayers () {
    return this.players
  }

  async createGame (groupId, e) {
    const stateMachine = new StateMachine()
    const playerQueryService = new PlayerQueryService()
    const victoryChecker = new VictoryChecker()
    // 移除 GameEventHandler 创建，功能已迁移到 NotificationCenter

    const game = new Game({
      e,
      config: this.gameConfig,
      players: this.players, // 这将被传递给PlayerManager
      stateMachine,
      playerQueryService,
      victoryChecker,
      // 移除 eventHandler 参数，Game类不再需要
      groupId // 传递groupId作为游戏ID
    })

    // 移除 eventHandler.setGame(game) 调用

    await GameRegistry.addGame(groupId, game)
    return game
  }
}
