import { GameConfig, PlayerStats } from '../components/services.js'
import { GameRegistry } from '../model/services/GameRegistry.js'
import { GameLobby } from '../model/services/GameLobby.js'
import { Player } from '../model/Player.js'

// A simple in-memory store for active lobbies
const lobbies = new Map()

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

    const lobby = new GameLobby(GameConfig)
    lobbies.set(e.group_id, lobby)

    const player = Player.fromEvent(e)
    lobby.addPlayer(player)

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

    if (lobby.hasPlayer(e.user_id)) {
      e.reply('你已经在游戏中了')
      return true
    }

    // 创建新玩家
    const player = Player.fromEvent(e)
    lobby.addPlayer(player)

    // 获取人数统计信息
    const currentCount = lobby.getPlayers().length
    const minPlayers = GameConfig.game.minPlayers
    const maxPlayers = GameConfig.game.maxPlayers

    // 构建人数统计消息
    let message = `${player.name} 加入了游戏 (${currentCount}/${maxPlayers})`

    if (currentCount < minPlayers) {
      const needed = minPlayers - currentCount
      message += `\n还需要 ${needed} 人才能开始游戏`
    } else {
      message += `\n人数已满足，可以开始游戏了！`
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
    const friendCheckResult = await this.checkFriendStatus(e, lobby)
    if (!friendCheckResult.allFriends) {
      // 存在非好友用户，暂停游戏开始
      const nonFriendsList = friendCheckResult.nonFriends.map(player => `@${player.name}`).join(' ')
      e.reply(`检测到以下玩家尚未添加机器人为好友：\n${nonFriendsList}\n\n请添加机器人好友后重新输入 #开始狼人杀`)

      // 设置10分钟超时自动解散lobby
      this.setLobbyTimeout(e.group_id, lobby, e)
      return true
    }

    // Create the game from the lobby
    const game = await lobby.createGame(e.group_id, e)

    // Set up event listeners
    game.on('gameEnd', (result) => {
      this.playerStats.updateStats(game, result)
    })

    // The game's start method should handle its own initialization
    const result = await game.start()

    if (result) {
      e.reply('游戏开始!')
      // Clean up the lobby once the game starts
      this.cleanupLobby(e.group_id)
    }
    return true
  }

  async endGame (e) {
    const groupId = e.group_id

    // The Game's own destructor/cleanup should handle event removal.
    // We just remove the game from the manager.
    GameRegistry.removeGame(groupId)
    this.cleanupLobby(groupId) // Also clean up lobby if it exists
    e.reply('游戏已结束')
    return true
  }

  /**
   * 检查lobby中所有玩家的好友状态
   * @param {Object} e 事件对象
   * @param {Object} lobby 游戏大厅对象
   * @returns {Promise<Object>} 检查结果 {allFriends: boolean, nonFriends: Array}
   */
  async checkFriendStatus (e, lobby) {
    const players = lobby.getPlayers()
    const nonFriends = []

    console.log(`[GameStart] 开始检查 ${players.length} 个玩家的好友状态`)

    for (const player of players) {
      try {
        // 方法1：尝试使用pickFriend发送测试消息来检测好友状态
        if (e.bot?.pickFriend) {
          try {
            const friend = e.bot.pickFriend(player.id)
            // 尝试获取好友信息，如果成功说明是好友
            await friend.getSimpleInfo()
            console.log(`[GameStart] 玩家 ${player.name}(${player.id}) 已是机器人好友`)
            continue // 是好友，继续下一个玩家
          } catch (friendError) {
            // pickFriend失败，说明不是好友
            console.log(`[GameStart] 玩家 ${player.name}(${player.id}) 不是机器人好友 (pickFriend失败)`)
          }
        }

        // 方法2：备选方案，尝试发送测试消息
        if (e.bot?.pickUser) {
          try {
            const user = e.bot.pickUser(player.id)
            // 尝试发送一个很短的测试消息（不会真正发送，只是测试权限）
            // 注意：这里我们不实际发送消息，只是检查是否有发送权限
            const friend = user.asFriend(true) // strict=true
            if (friend && friend.info) {
              console.log(`[GameStart] 玩家 ${player.name}(${player.id}) 已是机器人好友`)
              continue
            }
          } catch (userError) {
            console.log(`[GameStart] 玩家 ${player.name}(${player.id}) 用户检测失败:`, userError.message)
          }
        }

        // 如果所有方法都失败，认为不是好友
        nonFriends.push(player)
        console.log(`[GameStart] 玩家 ${player.name}(${player.id}) 最终判定为非好友`)

      } catch (error) {
        // 如果检测过程中出现异常，认为不是好友
        nonFriends.push(player)
        console.log(`[GameStart] 玩家 ${player.name}(${player.id}) 好友检测异常:`, error.message)
      }
    }

    return {
      allFriends: nonFriends.length === 0,
      nonFriends
    }
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
          console.error(`[GameStart] 发送超时通知失败:`, error)
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
