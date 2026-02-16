import { jest } from '@jest/globals'

function makeEvent (overrides = {}) {
  return {
    group_id: 100,
    user_id: 1,
    msg: '',
    member: { card: 'Card', nickname: 'Nick' },
    sender: { nickname: 'Sender' },
    reply: jest.fn(),
    ...overrides
  }
}

async function loadGameController ({
  maxPlayers = 2,
  gameStartOk = true,
  gameStartThrows = false,
  cleanupThrows = false
} = {}) {
  jest.resetModules()

  const start = jest.fn()
  if (gameStartThrows) start.mockRejectedValue(new Error('boom'))
  else start.mockResolvedValue(gameStartOk)

  class MockGame {
    constructor (args) {
      this.args = args
      this.start = start
      this.cleanup = jest.fn(() => {
        if (cleanupThrows) throw new Error('cleanup failed')
      })
    }
  }

  jest.unstable_mockModule('../../utils/GameConfig.js', () => ({
    default: { game: { maxPlayers } }
  }))
  jest.unstable_mockModule('../../models/Game.js', () => ({ Game: MockGame }))
  jest.unstable_mockModule('../../models/StateMachine.js', () => ({
    StateMachine: class {
      setContext () {}
    }
  }))
  jest.unstable_mockModule('../../models/VictoryChecker.js', () => ({
    VictoryChecker: class {}
  }))

  const { GameController } = await import('../../controllers/GameController.js')
  return { GameController, start, MockGame }
}

describe('GameController', () => {
  test('createGame creates lobby and auto-joins creator', async () => {
    const { GameController } = await loadGameController()
    const e = makeEvent({ group_id: 200, user_id: 42 })

    const ok = GameController.createGame(e)

    expect(ok).toBe(true)
    expect(GameController.hasLobby(200)).toBe(true)
    const lobby = GameController.getLobby(200)
    expect(lobby.players).toHaveLength(1)
    expect(lobby.players[0].id).toBe(42)
    expect(lobby.players[0].isCreator).toBe(true)
    expect(e.reply).toHaveBeenCalled()
  })

  test('createGame rejects when lobby/game already exists', async () => {
    const { GameController } = await loadGameController()
    const e = makeEvent({ group_id: 201, user_id: 1 })

    GameController.lobbies.set(201, { players: [], gameConfig: {} })
    expect(GameController.createGame(e)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('当前群已有游戏或大厅进行中')

    const e2 = makeEvent({ group_id: 202, user_id: 1 })
    GameController.games.set(202, {})
    expect(GameController.createGame(e2)).toBe(false)
    expect(e2.reply).toHaveBeenCalledWith('当前群已有游戏或大厅进行中')
  })

  test('joinGame rejects when no lobby, when already started, and when duplicate', async () => {
    const { GameController } = await loadGameController()
    const e = makeEvent({ group_id: 300, user_id: 10 })

    expect(GameController.joinGame(e)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('当前没有开放的游戏大厅，请先 #创建狼人杀')

    const e2 = makeEvent({ group_id: 301, user_id: 10 })
    GameController.games.set(301, {})
    expect(GameController.joinGame(e2)).toBe(false)
    expect(e2.reply).toHaveBeenCalledWith('游戏已经开始，无法加入')

    const e3 = makeEvent({ group_id: 302, user_id: 10 })
    GameController.lobbies.set(302, { players: [{ id: 10 }], gameConfig: { game: { maxPlayers: 10 } } })
    expect(GameController.joinGame(e3)).toBe(false)
    expect(e3.reply).toHaveBeenCalledWith('你已经在游戏中了')
  })

  test('joinGame enforces maxPlayers', async () => {
    const { GameController } = await loadGameController({ maxPlayers: 2 })
    const groupId = 400

    const creatorEvent = makeEvent({ group_id: groupId, user_id: 1 })
    expect(GameController.createGame(creatorEvent)).toBe(true)

    const joinEvent = makeEvent({ group_id: groupId, user_id: 2 })
    expect(GameController.joinGame(joinEvent)).toBe(true)

    const overEvent = makeEvent({ group_id: groupId, user_id: 3 })
    expect(GameController.joinGame(overEvent)).toBe(false)
    expect(overEvent.reply).toHaveBeenCalledWith('游戏人数已达上限2人')
  })

  test('startGame success moves lobby to games', async () => {
    const { GameController, start } = await loadGameController({ gameStartOk: true })
    const groupId = 500
    GameController.lobbies.set(groupId, { players: [], gameConfig: { game: { minPlayers: 1 } } })
    const e = makeEvent({ group_id: groupId, user_id: 1 })

    const ok = await GameController.startGame(e)

    expect(ok).toBe(true)
    expect(start).toHaveBeenCalled()
    expect(GameController.hasGame(groupId)).toBe(true)
    expect(GameController.hasLobby(groupId)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('游戏开始!')
  })

  test('startGame returns false when game.start() returns false', async () => {
    const { GameController } = await loadGameController({ gameStartOk: false })
    const groupId = 501
    GameController.lobbies.set(groupId, { players: [], gameConfig: { game: { minPlayers: 1 } } })
    const e = makeEvent({ group_id: groupId, user_id: 1 })

    const ok = await GameController.startGame(e)

    expect(ok).toBe(false)
    expect(GameController.hasGame(groupId)).toBe(false)
    expect(GameController.hasLobby(groupId)).toBe(true)
  })

  test('startGame catches errors and removes lobby', async () => {
    const { GameController } = await loadGameController({ gameStartThrows: true })
    const groupId = 502
    GameController.lobbies.set(groupId, { players: [], gameConfig: { game: { minPlayers: 1 } } })
    const e = makeEvent({ group_id: groupId, user_id: 1 })

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const ok = await GameController.startGame(e)
    spy.mockRestore()

    expect(ok).toBe(false)
    expect(GameController.hasGame(groupId)).toBe(false)
    expect(GameController.hasLobby(groupId)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('开始游戏失败，请重新创建大厅再试')
  })

  test('endGame calls cleanup and clears maps (cleanup errors are tolerated)', async () => {
    const { GameController, MockGame } = await loadGameController({ cleanupThrows: true })
    const groupId = 600
    const e = makeEvent({ group_id: groupId })

    const game = new MockGame({})
    GameController.games.set(groupId, game)
    GameController.lobbies.set(groupId, { players: [], gameConfig: {} })

    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const ok = GameController.endGame(e)
    spy.mockRestore()

    expect(ok).toBe(true)
    expect(game.cleanup).toHaveBeenCalled()
    expect(GameController.hasGame(groupId)).toBe(false)
    expect(GameController.hasLobby(groupId)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('游戏已结束')
  })
})
