/**
 * @file gameFlow.test.js
 * @description 端到端游戏流程测试
 * @module tests/e2e/gameFlow.test
 *
 * 这是 E2E 测试框架的示例用例，验证 MockBot + MessageRouter + TestOrchestrator 可用。
 * 完整的游戏流程测试需要 mock 掉定时器，或在实际集成环境中运行。
 */

import { jest } from '@jest/globals'

// Mock 全局 segment
global.segment = { image: jest.fn() }

// Mock logger
global.logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  blue: (s) => s,
  green: (s) => s,
  red: (s) => s
}

describe('E2E Game Flow', () => {
  let TestOrchestrator
  let orchestrator

  beforeAll(async () => {
    // 动态导入以确保全局变量已设置
    const module = await import('./TestOrchestrator.js')
    TestOrchestrator = module.TestOrchestrator
  })

  beforeEach(() => {
    orchestrator = new TestOrchestrator({ debug: false })
  })

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup()
    }
  })

  describe('Lobby Phase', () => {
    test('should create game lobby successfully', async () => {
      orchestrator.setupTestPlayers(6)

      await orchestrator.createGame()

      expect(orchestrator.bot.hasGroupMessageContaining('游戏大厅创建成功')).toBe(true)
    })

    test('should allow players to join lobby', async () => {
      orchestrator.setupTestPlayers(6)

      await orchestrator.createGame()
      await orchestrator.joinAllPlayers()

      expect(orchestrator.bot.hasGroupMessageContaining('加入成功')).toBe(true)
    })

    test('should prevent duplicate join', async () => {
      orchestrator.setupTestPlayers(6)
      const playerIds = Array.from(orchestrator.bot.players.keys())

      await orchestrator.createGame()
      // 创建者再次尝试加入
      await orchestrator.send(playerIds[0], '#加入狼人杀')

      expect(orchestrator.bot.hasGroupMessageContaining('你已经在游戏中了')).toBe(true)
    })

    test('should reject join when no lobby exists', async () => {
      orchestrator.setupTestPlayers(6)
      const playerIds = Array.from(orchestrator.bot.players.keys())

      // 未创建大厅就尝试加入
      await orchestrator.send(playerIds[0], '#加入狼人杀')

      expect(orchestrator.bot.hasGroupMessageContaining('当前没有开放的游戏大厅')).toBe(true)
    })

    test('should reject creating duplicate lobby', async () => {
      orchestrator.setupTestPlayers(6)
      const playerIds = Array.from(orchestrator.bot.players.keys())

      await orchestrator.createGame()
      orchestrator.bot.clearMessages()

      // 再次尝试创建
      await orchestrator.send(playerIds[1], '#创建狼人杀')

      expect(orchestrator.bot.hasGroupMessageContaining('当前群已有游戏或大厅进行中')).toBe(true)
    })

    test('should track correct player count in lobby', async () => {
      orchestrator.setupTestPlayers(4)

      await orchestrator.createGame()
      await orchestrator.joinAllPlayers()

      // 最后一条消息应显示当前人数：4
      expect(orchestrator.bot.hasGroupMessageContaining('当前人数：4')).toBe(true)
    })
  })

  describe('MockBot Core Functions', () => {
    test('should register players correctly', () => {
      orchestrator.setupTestPlayers(5)
      expect(orchestrator.bot.players.size).toBe(5)
    })

    test('should create valid event objects', () => {
      orchestrator.setupTestPlayers(3)
      const playerIds = Array.from(orchestrator.bot.players.keys())
      const event = orchestrator.bot.createEvent(playerIds[0], '#测试消息')

      expect(event.group_id).toBe(orchestrator.groupId)
      expect(event.user_id).toBe(playerIds[0])
      expect(event.msg).toBe('#测试消息')
      expect(typeof event.reply).toBe('function')
      expect(typeof event.bot.pickFriend).toBe('function')
    })

    test('should capture group messages via reply', () => {
      orchestrator.setupTestPlayers(2)
      const playerIds = Array.from(orchestrator.bot.players.keys())
      const event = orchestrator.bot.createEvent(playerIds[0], '#test')

      event.reply('测试回复')

      expect(orchestrator.bot.hasGroupMessageContaining('测试回复')).toBe(true)
    })

    test('should capture private messages via bot.pickFriend', () => {
      orchestrator.setupTestPlayers(2)
      const playerIds = Array.from(orchestrator.bot.players.keys())
      const event = orchestrator.bot.createEvent(playerIds[0], '#test')

      event.bot.pickFriend(playerIds[1]).sendMsg('私聊内容')

      const player = orchestrator.bot.getPlayer(playerIds[1])
      expect(player.hasPrivateMessageContaining('私聊内容')).toBe(true)
    })

    test('clearMessages should reset all message records', () => {
      orchestrator.setupTestPlayers(2)
      const playerIds = Array.from(orchestrator.bot.players.keys())
      const event = orchestrator.bot.createEvent(playerIds[0], '#test')

      event.reply('群消息')
      event.bot.pickFriend(playerIds[1]).sendMsg('私聊')

      orchestrator.bot.clearMessages()

      expect(orchestrator.bot.groupMessages.length).toBe(0)
      expect(orchestrator.bot.getPlayer(playerIds[1]).privateMessages.length).toBe(0)
    })
  })

  describe('MessageRouter', () => {
    test('should match game creation command', async () => {
      orchestrator.setupTestPlayers(3)
      const playerIds = Array.from(orchestrator.bot.players.keys())

      const result = await orchestrator.router.dispatch(
        orchestrator.bot.createEvent(playerIds[0], '#创建狼人杀')
      )

      expect(result.matched).toBe(true)
    })

    test('should match game join command', async () => {
      orchestrator.setupTestPlayers(3)
      const playerIds = Array.from(orchestrator.bot.players.keys())

      // 先创建大厅
      await orchestrator.createGame()

      const result = await orchestrator.router.dispatch(
        orchestrator.bot.createEvent(playerIds[1], '#加入狼人杀')
      )

      expect(result.matched).toBe(true)
    })

    test('should not match unknown commands', async () => {
      orchestrator.setupTestPlayers(2)
      const playerIds = Array.from(orchestrator.bot.players.keys())

      const result = await orchestrator.router.dispatch(
        orchestrator.bot.createEvent(playerIds[0], '随便说点什么')
      )

      expect(result.matched).toBe(false)
    })

    test('should return all registered patterns', () => {
      const patterns = orchestrator.router.getPatterns()
      expect(patterns.length).toBeGreaterThan(10) // 至少有10个命令
      expect(patterns.some(p => p.includes('创建'))).toBe(true)
      expect(patterns.some(p => p.includes('投票'))).toBe(true)
    })
  })

  describe('TestOrchestrator Utilities', () => {
    test('getSummary should return valid structure before game', () => {
      orchestrator.setupTestPlayers(4)

      const summary = orchestrator.getSummary()

      expect(summary.groupId).toBe(orchestrator.groupId)
      expect(summary.gameStarted).toBe(false)
      expect(summary.playerCount).toBe(4)
    })

    test('cleanup should be idempotent', async () => {
      orchestrator.setupTestPlayers(3)
      await orchestrator.createGame()

      await orchestrator.cleanup()
      await orchestrator.cleanup() // 再次调用不应报错

      expect(orchestrator.gameStarted).toBe(false)
    })
  })
})
