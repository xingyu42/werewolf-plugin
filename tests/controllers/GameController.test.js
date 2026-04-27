import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals'

const mockGameConfig = {
  game: {
    minPlayers: 2,
    maxPlayers: 3
  }
}

const mockPlayerFromEvent = jest.fn((e, options = {}) => ({
  id: e.user_id,
  name: e.member?.card || e.member?.nickname || e.sender?.nickname || `玩家${e.user_id}`,
  isAlive: true,
  isSheriff: false,
  ...options
}))

const mockGameInstances = []
let mockGameStartResult = true

const MockGame = jest.fn(function (options) {
  this.e = options.e
  this.config = options.config
  this.players = options.players
  this.stateMachine = options.stateMachine
  this.victoryChecker = options.victoryChecker
  this.groupId = options.groupId
  this.startTime = Date.now()
  this.start = jest.fn().mockResolvedValue(mockGameStartResult)
  this.cleanup = jest.fn()
  this.getPlayerCount = jest.fn(() => options.players.length)
  this.hasPlayer = jest.fn(userId => options.players.some(player => String(player.id) === String(userId)))
  mockGameInstances.push(this)
})

const MockStateMachine = jest.fn(function () {})
const MockVictoryChecker = jest.fn(function () {})

jest.unstable_mockModule('../../utils/GameConfig.js', () => ({
  default: mockGameConfig
}))

jest.unstable_mockModule('../../models/Player.js', () => ({
  Player: {
    fromEvent: mockPlayerFromEvent
  }
}))

jest.unstable_mockModule('../../models/Game.js', () => ({
  Game: MockGame
}))

jest.unstable_mockModule('../../models/StateMachine.js', () => ({
  StateMachine: MockStateMachine
}))

jest.unstable_mockModule('../../models/VictoryChecker.js', () => ({
  VictoryChecker: MockVictoryChecker
}))

const { GameController } = await import('../../controllers/GameController.js')

const createEvent = (overrides = {}) => ({
  group_id: 1001,
  user_id: 1,
  reply: jest.fn(),
  bot: {
    fl: {
      has: jest.fn(() => true)
    },
    pickFriend: jest.fn(),
    pickGroup: jest.fn(() => ({
      sendMsg: jest.fn().mockResolvedValue(true)
    }))
  },
  isMaster: false,
  msg: '',
  member: {
    card: '玩家1',
    nickname: '昵称1'
  },
  sender: {
    nickname: '发送者1'
  },
  ...overrides
})

const createLobby = (players = []) => ({
  players,
  gameConfig: mockGameConfig,
  friendReload: false
})

describe('GameController', () => {
  let consoleErrorSpy
  let consoleWarnSpy

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-04-28T00:00:00.000Z'))
    jest.clearAllMocks()

    GameController.games = new Map()
    GameController.lobbies = new Map()
    GameController.MAX_GAMES = 100
    GameController.GAME_TTL = 4 * 60 * 60 * 1000
    GameController.CLEANUP_TICK = 5 * 60 * 1000
    if (GameController._cleanupTimer) clearInterval(GameController._cleanupTimer)
    GameController._cleanupTimer = null

    mockGameStartResult = true
    mockGameInstances.length = 0
    MockGame.mockImplementation(function (options) {
      this.e = options.e
      this.config = options.config
      this.players = options.players
      this.stateMachine = options.stateMachine
      this.victoryChecker = options.victoryChecker
      this.groupId = options.groupId
      this.startTime = Date.now()
      this.start = jest.fn().mockResolvedValue(mockGameStartResult)
      this.cleanup = jest.fn()
      this.getPlayerCount = jest.fn(() => options.players.length)
      this.hasPlayer = jest.fn(userId => options.players.some(player => String(player.id) === String(userId)))
      mockGameInstances.push(this)
    })

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    if (GameController._cleanupTimer) clearInterval(GameController._cleanupTimer)
    GameController._cleanupTimer = null
    for (const lobby of GameController.lobbies.values()) {
      if (lobby.timeoutTimer) clearTimeout(lobby.timeoutTimer)
    }
    GameController.games.clear()
    GameController.lobbies.clear()
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  test('createGame should create lobby and add creator', () => {
    const e = createEvent()

    const result = GameController.createGame(e)

    expect(result).toBe(true)
    expect(mockPlayerFromEvent).toHaveBeenCalledWith(e, { isCreator: true })
    expect(GameController.hasLobby(1001)).toBe(true)
    expect(GameController.getLobby(1001).players).toHaveLength(1)
    expect(GameController.getLobby(1001).players[0].isCreator).toBe(true)
    expect(e.reply).toHaveBeenCalledWith(expect.stringContaining('游戏大厅创建成功'))
  })

  test('createGame should reject when max games reached', () => {
    const e = createEvent()
    GameController.MAX_GAMES = 1
    GameController.games.set(2001, { id: 'existing' })

    const result = GameController.createGame(e)

    expect(result).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('服务器游戏数已达上限，请稍后再试')
    expect(GameController.hasLobby(1001)).toBe(false)
  })

  test('createGame should reject when group already has game or lobby', () => {
    const e = createEvent()
    GameController.lobbies.set(1001, createLobby())

    const result = GameController.createGame(e)

    expect(result).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('当前群已有游戏或大厅进行中')
  })

  test('joinGame should add player and show ready hint when min players reached', () => {
    const e = createEvent({
      user_id: 2,
      member: {
        card: '玩家2',
        nickname: '昵称2'
      }
    })
    GameController.lobbies.set(1001, createLobby([
      { id: 1, name: '玩家1', isCreator: true }
    ]))

    const result = GameController.joinGame(e)

    expect(result).toBe(true)
    expect(mockPlayerFromEvent).toHaveBeenCalledWith(e)
    expect(GameController.getLobby(1001).players).toHaveLength(2)
    expect(e.reply).toHaveBeenCalledWith(expect.stringContaining('人数已满足，可以开始游戏了'))
  })

  test('joinGame should reject started game, missing lobby, duplicate player and full lobby', () => {
    const startedEvent = createEvent()
    GameController.games.set(1001, {})
    expect(GameController.joinGame(startedEvent)).toBe(false)
    expect(startedEvent.reply).toHaveBeenCalledWith('游戏已经开始，无法加入')

    GameController.games.clear()
    const missingLobbyEvent = createEvent()
    expect(GameController.joinGame(missingLobbyEvent)).toBe(false)
    expect(missingLobbyEvent.reply).toHaveBeenCalledWith('当前没有开放的游戏大厅，请先 #创建狼人杀')

    GameController.lobbies.set(1001, createLobby([{ id: 1, name: '玩家1' }]))
    const duplicateEvent = createEvent({ user_id: 1 })
    expect(GameController.joinGame(duplicateEvent)).toBe(false)
    expect(duplicateEvent.reply).toHaveBeenCalledWith('你已经在游戏中了')

    GameController.lobbies.set(1001, createLobby([
      { id: 1, name: '玩家1' },
      { id: 2, name: '玩家2' },
      { id: 3, name: '玩家3' }
    ]))
    const fullEvent = createEvent({ user_id: 4 })
    expect(GameController.joinGame(fullEvent)).toBe(false)
    expect(fullEvent.reply).toHaveBeenCalledWith('游戏人数已达上限3人')
  })

  test('startGame should create Game with injected dependencies and cleanup lobby', async () => {
    const e = createEvent()
    const players = [
      { id: 1, name: '玩家1', isCreator: true },
      { id: 2, name: '玩家2' }
    ]
    GameController.lobbies.set(1001, createLobby(players))

    const result = await GameController.startGame(e)

    expect(result).toBe(true)
    expect(MockStateMachine).toHaveBeenCalledTimes(1)
    expect(MockVictoryChecker).toHaveBeenCalledTimes(1)
    expect(MockGame).toHaveBeenCalledWith(expect.objectContaining({
      e,
      config: mockGameConfig,
      players,
      groupId: 1001
    }))
    expect(mockGameInstances[0].start).toHaveBeenCalledTimes(1)
    expect(GameController.getGame(1001)).toBe(mockGameInstances[0])
    expect(GameController.hasLobby(1001)).toBe(false)
    expect(GameController._cleanupTimer).not.toBeNull()
    expect(e.reply).toHaveBeenCalledWith('游戏开始!')
  })

  test('startGame should reject invalid states before constructing game', async () => {
    GameController.games.set(1001, {})
    const hasGameEvent = createEvent()
    await expect(GameController.startGame(hasGameEvent)).resolves.toBe(false)
    expect(hasGameEvent.reply).toHaveBeenCalledWith('当前群已有进行中的游戏')

    GameController.games.clear()
    const missingLobbyEvent = createEvent()
    await expect(GameController.startGame(missingLobbyEvent)).resolves.toBe(false)
    expect(missingLobbyEvent.reply).toHaveBeenCalledWith('当前没有开放的游戏大厅，请先 #创建狼人杀')

    GameController.lobbies.set(1001, createLobby([
      { id: 1, name: '创建者', isCreator: true }
    ]))
    const noPermissionEvent = createEvent({ user_id: 2, isMaster: false })
    await expect(GameController.startGame(noPermissionEvent)).resolves.toBe(false)
    expect(noPermissionEvent.reply).toHaveBeenCalledWith(expect.stringContaining('只有创建者'))
    expect(MockGame).not.toHaveBeenCalled()
  })

  test('startGame should allow master and reject non-friends with lobby timeout', async () => {
    const e = createEvent({
      user_id: 99,
      isMaster: true,
      bot: {
        fl: {
          has: jest.fn(userId => userId === 1)
        },
        pickGroup: jest.fn()
      }
    })
    const lobby = createLobby([
      { id: 1, name: '好友', isCreator: true },
      { id: 2, name: '非好友' }
    ])
    GameController.lobbies.set(1001, lobby)

    const result = await GameController.startGame(e)

    expect(result).toBe(false)
    expect(lobby.friendReload).toBe(true)
    expect(lobby.timeoutTimer).toBeTruthy()
    expect(e.reply).toHaveBeenCalledWith(expect.stringContaining('@非好友'))
    expect(MockGame).not.toHaveBeenCalled()
  })

  test('startGame should cleanup lobby when Game constructor throws', async () => {
    const e = createEvent()
    GameController.lobbies.set(1001, createLobby([
      { id: 1, name: '玩家1', isCreator: true }
    ]))
    MockGame.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    const result = await GameController.startGame(e)

    expect(result).toBe(false)
    expect(GameController.hasLobby(1001)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('开始游戏失败，请重新创建大厅再试')
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  test('startGame should return false without cleanup when game.start returns false', async () => {
    const e = createEvent()
    mockGameStartResult = false
    GameController.lobbies.set(1001, createLobby([
      { id: 1, name: '玩家1', isCreator: true }
    ]))

    const result = await GameController.startGame(e)

    expect(result).toBe(false)
    expect(GameController.hasLobby(1001)).toBe(true)
    expect(GameController.hasGame(1001)).toBe(false)
    expect(e.reply).not.toHaveBeenCalledWith('游戏开始!')
  })

  test('endGame should cleanup game and lobby even when cleanup throws', () => {
    const e = createEvent()
    const timeoutTimer = setTimeout(() => {}, 1000)
    const game = {
      cleanup: jest.fn(() => {
        throw new Error('cleanup failed')
      })
    }
    GameController.games.set(1001, game)
    GameController.lobbies.set(1001, { timeoutTimer })

    const result = GameController.endGame(e)

    expect(result).toBe(true)
    expect(game.cleanup).toHaveBeenCalledTimes(1)
    expect(GameController.hasGame(1001)).toBe(false)
    expect(GameController.hasLobby(1001)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('游戏已结束')
    expect(consoleWarnSpy).toHaveBeenCalled()
  })

  test('_checkFriendStatus should skip unsupported adapters and reload cache once', async () => {
    const unsupported = createEvent({ bot: {} })
    await expect(GameController._checkFriendStatus(unsupported, createLobby())).resolves.toEqual({
      allFriends: true,
      nonFriends: []
    })

    const reloadFriendList = jest.fn().mockResolvedValue(true)
    const e = createEvent({
      bot: {
        fl: {
          has: jest.fn(userId => userId === 1)
        },
        reloadFriendList
      }
    })
    const lobby = createLobby([
      { id: 1, name: '好友' },
      { id: 2, name: '非好友' }
    ])
    lobby.friendReload = true

    const result = await GameController._checkFriendStatus(e, lobby)

    expect(reloadFriendList).toHaveBeenCalledTimes(1)
    expect(result.allFriends).toBe(false)
    expect(result.nonFriends).toEqual([{ id: 2, name: '非好友' }])
    expect(lobby.friendReload).toBe(true)
  })

  test('_setLobbyTimeout should reset timer, notify group and cleanup lobby', async () => {
    const sendMsg = jest.fn().mockResolvedValue(true)
    const e = createEvent({
      bot: {
        fl: {
          has: jest.fn(() => true)
        },
        pickGroup: jest.fn(() => ({ sendMsg }))
      }
    })
    const oldTimer = setTimeout(() => {}, 1000)
    const lobby = createLobby()
    lobby.timeoutTimer = oldTimer
    GameController.lobbies.set(1001, lobby)

    GameController._setLobbyTimeout(1001, lobby, e)
    await jest.advanceTimersByTimeAsync(10 * 60 * 1000)

    expect(sendMsg).toHaveBeenCalledWith('游戏大厅因10分钟无活动自动解散，如需重新开始请输入 #创建狼人杀')
    expect(GameController.hasLobby(1001)).toBe(false)
  })

  test('getGameByPlayer should find matching game and handle missing user id', () => {
    const missGame = {
      hasPlayer: jest.fn(() => false)
    }
    const hitGame = {
      hasPlayer: jest.fn(userId => String(userId) === '2')
    }
    GameController.games.set(1001, missGame)
    GameController.games.set(1002, hitGame)

    expect(GameController.getGameByPlayer(null)).toBeNull()
    expect(GameController.getGameByPlayer(2)).toBe(hitGame)
    expect(GameController.getGameByPlayer(3)).toBeNull()
  })

  test('getStats should summarize active resources and cleanup timer status', () => {
    GameController.games.set(1001, { getPlayerCount: jest.fn(() => 2) })
    GameController.games.set(1002, { getPlayerCount: jest.fn(() => 3) })
    GameController.lobbies.set(1003, createLobby())
    GameController._cleanupTimer = setInterval(() => {}, 1000)

    expect(GameController.getStats()).toEqual({
      activeGames: 2,
      activeLobbies: 1,
      totalPlayers: 5,
      cleanupTimerActive: true
    })
  })

  test('_performAutoCleanup should end only expired games', async () => {
    const expiredGame = {
      startTime: Date.now() - GameController.GAME_TTL - 1,
      e: {
        reply: jest.fn().mockResolvedValue(true)
      },
      cleanup: jest.fn()
    }
    const freshGame = {
      startTime: Date.now(),
      e: {
        reply: jest.fn()
      },
      cleanup: jest.fn()
    }
    GameController.games.set(1001, expiredGame)
    GameController.games.set(1002, freshGame)

    await GameController._performAutoCleanup()

    expect(expiredGame.e.reply).toHaveBeenCalledWith('游戏因超时（4小时无活动）自动结束')
    expect(expiredGame.cleanup).toHaveBeenCalledTimes(1)
    expect(GameController.hasGame(1001)).toBe(false)
    expect(GameController.hasGame(1002)).toBe(true)
  })

  test('gracefulShutdown should stop timers, notify games and clear all maps', async () => {
    const lobbyTimer = setTimeout(() => {}, 1000)
    const game = {
      e: {
        reply: jest.fn().mockResolvedValue(true)
      },
      cleanup: jest.fn()
    }
    GameController._cleanupTimer = setInterval(() => {}, 1000)
    GameController.lobbies.set(1001, { timeoutTimer: lobbyTimer })
    GameController.games.set(1001, game)

    await GameController.gracefulShutdown()

    expect(GameController._cleanupTimer).toBeNull()
    expect(game.e.reply).toHaveBeenCalledWith('服务器即将关闭，游戏被迫结束')
    expect(game.cleanup).toHaveBeenCalledTimes(1)
    expect(GameController.games.size).toBe(0)
    expect(GameController.lobbies.size).toBe(0)
  })
})
