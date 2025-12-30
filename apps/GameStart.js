/**
 * @file GameStart.js
 * @description 游戏启动和大厅管理应用，处理创建房间、加入游戏、开始游戏等命令
 * @module apps/GameStart
 *
 * @input GameConfig, PlayerStats (services), GameRegistry, Player, ErrorHandler, Game, StateMachine, PlayerQueryService, VictoryChecker
 * @output GameStart - 继承 plugin 的应用类
 * @pos 应用层 - 处理用户命令，协调游戏生命周期
 *
 * @dependencies
 * - ../components/services.js - GameConfig, PlayerStats
 * - ../model/cqrs/GameRegistry.js - 游戏实例注册
 * - ../model/core/Player.js - 玩家实体
 * - ../model/core/ErrorHandler.js - 错误处理
 * - ../model/core/Game.js - 游戏聚合根
 * - ../model/core/StateMachine.js - 状态机
 * - ../model/cqrs/PlayerQueryService.js - 玩家查询服务
 * - ../model/core/VictoryChecker.js - 胜利检查器
 */
import { GameConfig, PlayerStats } from '../components/services.js'
import { GameRegistry } from '../model/cqrs/GameRegistry.js'
import { Player } from '../model/core/Player.js'
import { defaultErrorHandler } from '../model/core/ErrorHandler.js'
import { Game } from '../model/core/Game.js'
import { StateMachine } from '../model/core/StateMachine.js'
import { PlayerQueryService } from '../model/cqrs/PlayerQueryService.js'
import { VictoryChecker } from '../model/core/VictoryChecker.js'

// 简化的游戏大厅数据结构，替代 GameLobby 类
// 结构：{ players: Player[], gameConfig: Object, botReference?: Object, timeoutTimer?: Timer }
const lobbies = new Map()

/**
 * 大厅管理工具函数 - 替代 GameLobby 类
 */
const LobbyUtils = {
  // 创建新大厅
  createLobby (gameConfig) {
    return {
      players: [],
      gameConfig,
      FriendReload: false // 好友列表刷新标志
    }
  },

  // 检查玩家是否已在大厅中
  hasPlayer (lobby, playerId) {
    return lobby.players.some(p => p.id === playerId)
  },

  // 添加玩家到大厅
  addPlayer (lobby, player) {
    const playerCount = lobby.players.length
    const maxPlayers = lobby.gameConfig.game.maxPlayers

    if (playerCount >= maxPlayers) {
      throw new Error(`游戏人数已达上限${maxPlayers}人`)
    }

    if (LobbyUtils.hasPlayer(lobby, player.id)) {
      throw new Error('该玩家已经在游戏中')
    }

    lobby.players.push(player)
    return lobby
  },

  // 获取大厅玩家列表
  getPlayers (lobby) {
    return lobby.players
  },

  // 创建游戏实例 - 替代 GameLobby.createGame()
  async createGame (lobby, groupId, e) {
    const stateMachine = new StateMachine()
    const playerQueryService = new PlayerQueryService()
    const victoryChecker = new VictoryChecker()

    const game = new Game({
      e,
      config: lobby.gameConfig,
      players: lobby.players,
      stateMachine,
      playerQueryService,
      victoryChecker,
      groupId
    })

    await GameRegistry.addGame(groupId, game)
    return game
  }
}

export class GameStart extends plugin {
  constructor () {
    super({
      name: '狼人杀',
      dsc: '狼人杀游戏',
      event: 'message',
      priority: 5000,
      rule: [
        { reg: '^#创建(狼人杀|lrs)$', fnc: 'createGame' },
        { reg: '^#加入(狼人杀|lrs)$', fnc: 'joinGame' },
        { reg: '^#开始(狼人杀|lrs)$', fnc: 'startGame' },
        { reg: '^#结束(狼人杀|lrs)$', fnc: 'endGame' }
      ]
    })

    this.playerStats = PlayerStats
  }

  async createGame (e) {
    // 使用增强的hasGame方法检查游戏状态
    const hasExistingGame = await GameRegistry.hasGame(e.group_id)
    if (hasExistingGame || lobbies.has(e.group_id)) {
      e.reply('当前群已有游戏或大厅进行中')
      return true
    }

    const lobby = LobbyUtils.createLobby(GameConfig)
    lobbies.set(e.group_id, lobby)

    const player = Player.fromEvent(e)
    LobbyUtils.addPlayer(lobby, player)

    e.reply(`游戏大厅创建成功，${player.name} 已自动加入游戏，其他玩家请输入 #加入狼人杀 参与`)
    return true
  }

  // 辅助方法：获取当前群游戏实例，避免重复验证代码
  async _getGameInstance (e) {
    const gameInstance = GameRegistry.getGame(e.group_id)
    if (!gameInstance) {
      e.reply('当前群没有进行中的狼人杀')
      return null
    }
    return gameInstance
  }

  async joinGame (e) {
    // 使用增强的hasGame方法检查游戏状态
    const hasExistingGame = await GameRegistry.hasGame(e.group_id)
    if (hasExistingGame) {
      e.reply('游戏已经开始，无法加入')
      return true
    }

    const lobby = lobbies.get(e.group_id)
    if (!lobby) {
      e.reply('当前没有开放的游戏大厅，请先 #创建狼人杀')
      return true
    }

    if (LobbyUtils.hasPlayer(lobby, e.user_id)) {
      e.reply('你已经在游戏中了')
      return true
    }

    // 创建新玩家
    const player = Player.fromEvent(e)
    LobbyUtils.addPlayer(lobby, player)

    // 获取人数统计信息
    const currentCount = LobbyUtils.getPlayers(lobby).length
    const minPlayers = GameConfig.game.minPlayers

    // 构建人数统计消息
    let message = `${player.name} 加入了游戏 (当前人数: ${currentCount})`

    if (currentCount < minPlayers) {
      const needed = minPlayers - currentCount
      message += `\n还需要 ${needed} 人才能开始游戏`
    } else {
      message += '\n人数已满足，可以开始游戏了！'
    }

    e.reply(message)
    return true
  }

  async startGame (e) {
    const lobby = lobbies.get(e.group_id)
    if (!lobby) {
      e.reply('没有找到可以开始的游戏大厅')
      return true
    }

    // 好友状态预检测
    const players = LobbyUtils.getPlayers(lobby)
    const friendCheckResult = await this.validateBatch(players, e)
    if (!friendCheckResult.allFriends) {
      // 存在非好友用户，暂停游戏开始
      const nonFriendsList = friendCheckResult.nonFriends.map(player => `@${player.name}`).join(' ')
      e.reply(`检测到以下玩家尚未添加机器人为好友：\n${nonFriendsList}\n\n请添加机器人好友后重新输入 #开始狼人杀`)

      // 设置10分钟超时自动解散lobby
      this.setLobbyTimeout(e.group_id, lobby, e)
      return true
    }

    try {
      const game = await LobbyUtils.createGame(lobby, e.group_id, e)
      const result = await game.start()

      if (result) {
        e.reply('游戏开始!')
        this.cleanupLobby(e.group_id)
      }
    } catch (error) {
      // 使用统一的错误处理器
      const context = {
        groupId: e.group_id,
        playerCount: LobbyUtils.getPlayers(lobby).length,
        action: 'startGame'
      }

      defaultErrorHandler.handle(error, context, e)

      // 清理资源：移除可能已创建的游戏实例
      try {
        const { GameRegistry } = await import('../model/cqrs/GameRegistry.js')
        GameRegistry.removeGame(e.group_id)
      } catch (cleanupError) {
        console.warn('[GameStart] 清理游戏资源时出错:', cleanupError)
      }
    }

    return true
  }

  /**
   * 批量检查玩家好友状态
   * @param {Array} players - 玩家对象数组
   * @param {Object} e - 事件对象
   * @returns {Promise<Object>} 检查结果 {allFriends: boolean, nonFriends: Array}
   */
  async validateBatch (players, e) {
    const nonFriends = []

    console.log(`[GameStart] 开始检查 ${players.length} 个玩家的好友状态`)

    // 刷新好友列表缓存 - 从lobby状态读取
    const lobby = lobbies.get(e.group_id)
    if (lobby?.FriendReload) {
      console.log('[GameStart] 刷新好友列表缓存...')
      await e.bot.reloadFriendList()
      lobby.FriendReload = false
    }

    for (const player of players) {
      const isFriend = e.bot.fl.has(parseInt(player.id))
      console.log(`[GameStart] 玩家 ${player.id} ${isFriend ? '在' : '不在'}好友列表中`)
      if (!isFriend) {
        nonFriends.push(player)
      }
    }

    // 如果有非好友，设置lobby刷新标志供下次检查使用
    if (nonFriends.length > 0 && lobby) {
      lobby.FriendReload = true
      console.log('[GameStart] 检测到非好友，设置下次检查刷新标志')
    }

    console.log(`[GameStart] 好友检查完成，${nonFriends.length} 个非好友`)

    return {
      allFriends: nonFriends.length === 0,
      nonFriends
    }
  }

  async endGame (e) {
    const groupId = e.group_id

    GameRegistry.removeGame(groupId)
    this.cleanupLobby(groupId) // Also clean up lobby if it exists
    e.reply('游戏已结束')
    return true
  }

  /**
   * 设置lobby超时自动解散机制
   * @param {string} groupId 群组ID
   * @param {Object} lobby 游戏大厅对象
   * @param {Object} e 事件对象，用于获取bot实例
   */
  setLobbyTimeout (groupId, lobby, e) {
    // 清除之前的超时定时器（如果存在）
    if (lobby.timeoutTimer) {
      clearTimeout(lobby.timeoutTimer)
    }

    // 保存bot引用以便在超时回调中使用
    lobby.botReference = e.bot

    // 设置10分钟超时
    lobby.timeoutTimer = setTimeout(async () => {
      if (lobbies.has(groupId)) {
        console.log(`[GameStart] 群 ${groupId} 的游戏大厅因超时自动解散`)

        // 先发送通知，再清理lobby
        try {
          // 使用保存的bot引用发送群消息
          if (lobby.botReference && lobby.botReference.pickGroup) {
            const group = lobby.botReference.pickGroup(groupId)
            await group.sendMsg('游戏大厅因10分钟无活动自动解散，如需重新开始请输入 #创建狼人杀')
          }
        } catch (error) {
          console.error('[GameStart] 发送超时通知失败:', error)
        }

        // 清理lobby（不需要清理定时器，因为这就是定时器回调）
        lobbies.delete(groupId)
      }
    }, 10 * 60 * 1000) // 10分钟

    console.log(`[GameStart] 已为群 ${groupId} 设置10分钟超时自动解散`)
  }

  /**
   * 安全清理lobby，包括清除超时定时器
   * @param {string} groupId 群组ID
   */
  cleanupLobby (groupId) {
    const lobby = lobbies.get(groupId)
    if (lobby) {
      // 清除超时定时器
      if (lobby.timeoutTimer) {
        clearTimeout(lobby.timeoutTimer)
        lobby.timeoutTimer = null
        console.log(`[GameStart] 已清除群 ${groupId} 的超时定时器`)
      }

      // 删除lobby
      lobbies.delete(groupId)
      console.log(`[GameStart] 已清理群 ${groupId} 的游戏大厅`)
    }
  }
}
