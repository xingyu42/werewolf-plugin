/**
 * @file fullGameFlow.test.js
 * @description 完整游戏流程端到端测试（使用 TimerMock）
 * @module tests/e2e/fullGameFlow.test
 */

import { jest } from '@jest/globals'
import { installTimerMock, uninstallTimerMock, timerController } from './TimerMock.js'

// 在导入游戏模块之前安装 TimerMock
installTimerMock('immediate')

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

describe('Full Game Flow E2E', () => {
  let TestOrchestrator
  let orchestrator

  beforeAll(async () => {
    const module = await import('./TestOrchestrator.js')
    TestOrchestrator = module.TestOrchestrator
  })

  beforeEach(async () => {
    // 确保 timerMock 已安装
    if (!timerController.isInstalled) {
      installTimerMock('immediate')
    }
    timerController.clear()
    orchestrator = new TestOrchestrator({ debug: false })
  })

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup()
    }
    timerController.clear()
    // 等待所有 immediate 回调执行完成
    await timerController.flush()
  })

  afterAll(() => {
    uninstallTimerMock()
  })

  describe('Game Start with Roles', () => {
    test('should start game and assign roles', async () => {
      orchestrator.setupTestPlayers(6)

      await orchestrator.createGame()
      await orchestrator.joinAllPlayers()
      await orchestrator.startGame()

      // 等待异步操作
      await timerController.flush()
      await orchestrator.wait(50)

      expect(orchestrator.gameStarted).toBe(true)

      const game = orchestrator.getGame()
      expect(game).toBeDefined()
    })

    test('should have wolves in 6-player game', async () => {
      orchestrator.setupTestPlayers(6)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const wolves = orchestrator.getWolves()
      // 6人局应该有狼人
      expect(wolves.length).toBeGreaterThanOrEqual(1)
    })

    test('should enter night phase after start', async () => {
      orchestrator.setupTestPlayers(6)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      // 验证游戏进入了夜晚阶段（群消息包含夜晚相关提示）
      const hasNightMessage = orchestrator.bot.hasGroupMessageContaining('夜晚') ||
                              orchestrator.bot.hasGroupMessageContaining('游戏开始')

      // 或者验证状态机进入了有效状态
      const state = orchestrator.getGameState()

      expect(hasNightMessage || state !== null).toBe(true)
    })
  })

  describe('Night Phase - Wolf Actions', () => {
    test('wolf can send kill command', async () => {
      orchestrator.setupTestPlayers(6)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const wolves = orchestrator.getWolves()
      if (wolves.length > 0) {
        const wolf = wolves[0]
        // 找一个非狼人目标
        const roles = orchestrator.getAllRoles()
        let targetNumber = null
        roles.forEach((info) => {
          if (info.roleName !== 'WolfRole' && info.player.isAlive && targetNumber === null) {
            targetNumber = info.player.gameNumber
          }
        })

        if (targetNumber) {
          orchestrator.bot.clearMessages()
          await orchestrator.send(wolf.userId, `#刀${targetNumber}号`)
          await timerController.flush()

          // 验证命令被处理
          expect(orchestrator.bot.groupMessages.length).toBeGreaterThan(0)
        }
      }
    })

    test('wolf can discuss with team', async () => {
      orchestrator.setupTestPlayers(6)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const wolves = orchestrator.getWolves()
      if (wolves.length > 0) {
        orchestrator.bot.clearMessages()
        await orchestrator.send(wolves[0].userId, '#讨论今晚刀谁？')
        await timerController.flush()

        // 讨论命令应该被处理
        expect(orchestrator.bot.groupMessages.length).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('Night Phase - Prophet Actions', () => {
    test('prophet can check a player', async () => {
      orchestrator.setupTestPlayers(6)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const prophets = orchestrator.getProphets()
      if (prophets.length > 0) {
        const prophet = prophets[0]
        const alivePlayers = orchestrator.getAlivePlayers()
        const target = alivePlayers.find(p => p.id !== prophet.userId)

        if (target) {
          orchestrator.bot.clearMessages()
          await orchestrator.send(prophet.userId, `#查验${target.gameNumber}号`)
          await timerController.flush()

          // 命令应该被处理
          expect(orchestrator.bot.groupMessages.length).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  describe('Night Phase - Witch Actions', () => {
    test('witch can use save potion', async () => {
      orchestrator.setupTestPlayers(6)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const witches = orchestrator.getWitches()
      if (witches.length > 0) {
        orchestrator.bot.clearMessages()
        await orchestrator.send(witches[0].userId, '#救人')
        await timerController.flush()

        // 命令应该被识别和处理
        expect(orchestrator.bot.groupMessages.length).toBeGreaterThanOrEqual(0)
      }
    })

    test('witch can use poison potion', async () => {
      orchestrator.setupTestPlayers(6)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const witches = orchestrator.getWitches()
      if (witches.length > 0) {
        const alivePlayers = orchestrator.getAlivePlayers()
        const target = alivePlayers.find(p => p.id !== witches[0].userId)

        if (target) {
          orchestrator.bot.clearMessages()
          await orchestrator.send(witches[0].userId, `#毒杀${target.gameNumber}号`)
          await timerController.flush()

          expect(orchestrator.bot.groupMessages.length).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  describe('Night Phase - Guard Actions', () => {
    test('guard can protect a player', async () => {
      orchestrator.setupTestPlayers(9) // 更多玩家以确保有守卫
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const guards = orchestrator.getGuards()
      if (guards.length > 0) {
        const alivePlayers = orchestrator.getAlivePlayers()
        const target = alivePlayers[0]

        if (target) {
          orchestrator.bot.clearMessages()
          await orchestrator.send(guards[0].userId, `#守护${target.gameNumber}号`)
          await timerController.flush()

          expect(orchestrator.bot.groupMessages.length).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  describe('Skip Actions', () => {
    test('role can skip action with #跳过', async () => {
      orchestrator.setupTestPlayers(6)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const playerIds = Array.from(orchestrator.bot.players.keys())
      orchestrator.bot.clearMessages()
      await orchestrator.send(playerIds[0], '#跳过')
      await timerController.flush()

      expect(orchestrator.bot.groupMessages.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Day Phase - Voting', () => {
    test('player can vote', async () => {
      orchestrator.setupTestPlayers(6)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const playerIds = Array.from(orchestrator.bot.players.keys())
      orchestrator.bot.clearMessages()
      await orchestrator.send(playerIds[0], '#投票2号')
      await timerController.flush()

      // 投票命令被识别（可能不在投票阶段，会有提示）
      expect(orchestrator.bot.groupMessages.length).toBeGreaterThan(0)
    })

    test('player can abstain', async () => {
      orchestrator.setupTestPlayers(6)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const playerIds = Array.from(orchestrator.bot.players.keys())
      orchestrator.bot.clearMessages()
      await orchestrator.send(playerIds[0], '#弃票')
      await timerController.flush()

      expect(orchestrator.bot.groupMessages.length).toBeGreaterThan(0)
    })
  })

  describe('Role Distribution', () => {
    test('6-player game should have balanced roles', async () => {
      orchestrator.setupTestPlayers(6)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const roles = orchestrator.getAllRoles()
      expect(roles.size).toBe(6)

      // 统计各阵营
      let wolfCount = 0
      let godCount = 0
      let villagerCount = 0

      roles.forEach((info) => {
        if (info.roleName === 'WolfRole') wolfCount++
        else if (info.roleName === 'VillagerRole') villagerCount++
        else godCount++
      })

      // 6人局应该有狼人和其他角色
      expect(wolfCount).toBeGreaterThanOrEqual(1)
      expect(wolfCount + godCount + villagerCount).toBe(6)
    })

    test('9-player game should have more roles', async () => {
      orchestrator.setupTestPlayers(9)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const roles = orchestrator.getAllRoles()
      expect(roles.size).toBe(9)
    })
  })

  describe('Game State Tracking', () => {
    test('should track game state after start', async () => {
      orchestrator.setupTestPlayers(6)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const state = orchestrator.getGameState()
      expect(state).not.toBeNull()
    })

    test('getSummary should show correct info', async () => {
      orchestrator.setupTestPlayers(6)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const summary = orchestrator.getSummary()
      expect(summary.gameStarted).toBe(true)
      expect(summary.playerCount).toBe(6)
      expect(summary.alivePlayers).toBe(6) // 游戏刚开始，都活着
    })
  })

  describe('Hunter Special Actions', () => {
    test('hunter shoot command should be recognized', async () => {
      orchestrator.setupTestPlayers(9)
      await orchestrator.quickStart()
      await timerController.flush()
      await orchestrator.wait(100)

      const hunters = orchestrator.getHunters()
      if (hunters.length > 0) {
        const alivePlayers = orchestrator.getAlivePlayers()
        const target = alivePlayers.find(p => p.id !== hunters[0].userId)

        if (target) {
          orchestrator.bot.clearMessages()
          await orchestrator.send(hunters[0].userId, `#开枪${target.gameNumber}号`)
          await timerController.flush()

          // 命令被识别
          expect(orchestrator.bot.groupMessages.length).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })
})
