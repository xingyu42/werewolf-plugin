/**
 * @file TestOrchestrator.js
 * @description 测试编排器，协调 MockBot 和 MessageRouter 进行端到端测试
 * @module tests/e2e/TestOrchestrator
 *
 * 核心功能：
 * - 初始化测试环境
 * - 管理游戏生命周期
 * - 提供便捷的测试 API
 */

import { MockBot } from './MockBot.js'
import { MessageRouter } from './MessageRouter.js'
import { GameController } from '../../controllers/GameController.js'

/**
 * 测试编排器
 */
export class TestOrchestrator {
  constructor (options = {}) {
    this.groupId = options.groupId || 100000 + Math.floor(Math.random() * 100000)
    this.bot = new MockBot(this.groupId)
    this.router = new MessageRouter()
    this.bot.setMessageHandler(this.router.createHandler())
    this.gameStarted = false
    this.debug = options.debug || false
  }

  /**
   * 设置测试玩家
   * @param {Array<{id: number, name: string}>} players
   */
  setupPlayers (players) {
    this.bot.registerPlayers(players)
    return this
  }

  /**
   * 快速设置 N 个测试玩家
   */
  setupTestPlayers (count) {
    const players = []
    for (let i = 1; i <= count; i++) {
      players.push({ id: 1000 + i, name: `测试玩家${i}` })
    }
    return this.setupPlayers(players)
  }

  /**
   * 玩家发送消息
   */
  async send (userId, msg) {
    if (this.debug) {
      console.log(`[Test] Player ${userId}: ${msg}`)
    }
    const result = await this.bot.send(userId, msg)
    if (this.debug && this.bot.getLastGroupMessage()) {
      console.log(`[Test] Bot reply: ${this.bot.getLastGroupMessage()}`)
    }
    return result
  }

  /**
   * 创建游戏大厅
   */
  async createGame (creatorId) {
    const playerIds = Array.from(this.bot.players.keys())
    const creator = creatorId || playerIds[0]
    if (!creator) {
      throw new Error('No players registered. Call setupPlayers first.')
    }
    await this.send(creator, '#创建狼人杀')
    return this
  }

  /**
   * 所有玩家加入游戏
   */
  async joinAllPlayers () {
    const playerIds = Array.from(this.bot.players.keys())
    // 跳过第一个玩家（创建者已自动加入）
    for (let i = 1; i < playerIds.length; i++) {
      await this.send(playerIds[i], '#加入狼人杀')
    }
    return this
  }

  /**
   * 开始游戏
   */
  async startGame (starterId) {
    const playerIds = Array.from(this.bot.players.keys())
    const starter = starterId || playerIds[0]
    await this.send(starter, '#开始狼人杀')
    this.gameStarted = true
    return this
  }

  /**
   * 快速初始化：创建 -> 加入 -> 开始
   */
  async quickStart () {
    await this.createGame()
    await this.joinAllPlayers()
    await this.startGame()
    return this
  }

  /**
   * 获取当前游戏实例
   */
  getGame () {
    return GameController.getGame(this.groupId)
  }

  /**
   * 获取玩家角色信息
   */
  getPlayerRole (userId) {
    const game = this.getGame()
    if (!game) return null
    return game.roles?.get(userId) || null
  }

  /**
   * 获取所有玩家角色映射
   */
  getAllRoles () {
    const game = this.getGame()
    if (!game) return new Map()
    const result = new Map()
    game.players.forEach(p => {
      const role = game.roles?.get(p.id)
      result.set(p.id, {
        player: p,
        role: role,
        roleName: role?.constructor?.name || 'Unknown'
      })
    })
    return result
  }

  /**
   * 按角色类型获取玩家
   */
  getPlayersByRole (roleName) {
    const roles = this.getAllRoles()
    const result = []
    roles.forEach((info, userId) => {
      if (info.roleName === roleName) {
        result.push({ userId, ...info })
      }
    })
    return result
  }

  /**
   * 获取狼人玩家
   */
  getWolves () {
    return this.getPlayersByRole('WolfRole')
  }

  /**
   * 获取预言家玩家
   */
  getProphets () {
    return this.getPlayersByRole('ProphetRole')
  }

  /**
   * 获取女巫玩家
   */
  getWitches () {
    return this.getPlayersByRole('WitchRole')
  }

  /**
   * 获取猎人玩家
   */
  getHunters () {
    return this.getPlayersByRole('HunterRole')
  }

  /**
   * 获取守卫玩家
   */
  getGuards () {
    return this.getPlayersByRole('GuardRole')
  }

  /**
   * 获取村民玩家
   */
  getVillagers () {
    return this.getPlayersByRole('VillagerRole')
  }

  /**
   * 获取当前游戏状态
   */
  getGameState () {
    const game = this.getGame()
    if (!game) return null
    return game.stateMachine?.getCurrentState?.() || null
  }

  /**
   * 获取当前状态名称
   */
  getStateName () {
    const state = this.getGameState()
    return state?.getName?.() || state?.constructor?.name || null
  }

  /**
   * 等待指定时间（用于等待异步状态转换）
   */
  async wait (ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 等待游戏状态变为指定状态
   */
  async waitForState (stateName, timeout = 5000) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (this.getStateName() === stateName) {
        return true
      }
      await this.wait(50)
    }
    throw new Error(`Timeout waiting for state: ${stateName}, current: ${this.getStateName()}`)
  }

  /**
   * 获取存活玩家
   */
  getAlivePlayers () {
    const game = this.getGame()
    if (!game) return []
    return game.getAlivePlayers?.() || []
  }

  /**
   * 检查游戏是否结束
   */
  isGameOver () {
    const game = this.getGame()
    return !game || game.isEnded?.() || false
  }

  /**
   * 清理测试环境
   */
  async cleanup () {
    const game = this.getGame()
    if (game) {
      try {
        await game.cleanup?.()
      } catch (e) {
        // 忽略清理错误
      }
      GameController.games.delete(this.groupId)
    }
    GameController.lobbies.delete(this.groupId)
    this.bot.clearMessages()
    this.gameStarted = false
  }

  /**
   * 获取测试摘要
   */
  getSummary () {
    const stats = this.bot.getStats()
    const game = this.getGame()
    return {
      groupId: this.groupId,
      gameStarted: this.gameStarted,
      currentState: this.getStateName(),
      ...stats,
      alivePlayers: this.getAlivePlayers().length,
      isGameOver: this.isGameOver()
    }
  }

  /**
   * 打印调试信息
   */
  printDebug () {
    console.log('\n=== Test Orchestrator Debug ===')
    console.log(JSON.stringify(this.getSummary(), null, 2))
    this.bot.debug()
    console.log('================================\n')
  }
}

export default TestOrchestrator
