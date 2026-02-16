import { jest } from '@jest/globals'

function makeEvent () {
  return {
    reply: jest.fn(async () => true),
    bot: {
      pickFriend: jest.fn(() => ({ sendMsg: jest.fn(async () => true) }))
    }
  }
}

function makeStateMachine () {
  let currentState = null
  return {
    setContext: jest.fn(),
    changeState: jest.fn(async (newState) => { currentState = newState }),
    getCurrentState: jest.fn(() => currentState),
    setStateTransitionContext: jest.fn()
  }
}

async function loadGame ({
  roleCamps = Object.create(null),
  roleConfiguratorGenerate = null,
  roleFactoryCreateRole = null,
  wolfStats = null,
  playerStatsImportThrows = false,
  wolfRoleImportThrows = false,
  wolfRoleGetStatsThrows = false
} = {}) {
  jest.resetModules()

  const RoleFactory = {
    getRoleCamp: jest.fn((roleName) => roleCamps[roleName] || null),
    createRole: jest.fn(roleFactoryCreateRole || (() => ({ getCamp: () => 'GOD' })))
  }

  const RoleConfigurator = {
    generate: jest.fn(roleConfiguratorGenerate || ((count) => Array.from({ length: count }, () => 'WOLF')))
  }

  class NightPhaseController {
    constructor (game) {
      this.game = game
    }
    getName () {
      return 'NightPhaseController'
    }
  }

  const PlayerStats = { updateStats: jest.fn() }
  const WolfRole = {
    cleanup: jest.fn(),
    getStats: jest.fn(() => {
      if (wolfRoleGetStatsThrows) throw new Error('stats failed')
      return (wolfStats || { voteCount: 0, hasKillTarget: false })
    })
  }

  jest.unstable_mockModule('../../models/roles/RoleFactory.js', () => ({ RoleFactory }))
  jest.unstable_mockModule('../../utils/configurators/RoleConfigurator.js', () => ({ RoleConfigurator }))
  jest.unstable_mockModule('../../models/states/NightPhaseController.js', () => ({ NightPhaseController }))
  jest.unstable_mockModule('../../utils/PlayerStats.js', () => {
    if (playerStatsImportThrows) throw new Error('PlayerStats load failed')
    return { default: PlayerStats }
  })
  jest.unstable_mockModule('../../models/roles/WolfRole.js', () => {
    if (wolfRoleImportThrows) throw new Error('WolfRole load failed')
    return { WolfRole }
  })

  const { Game } = await import('../../models/Game.js')
  const { GAME_PHASES } = await import('../../models/Constants.js')

  return { Game, GAME_PHASES, RoleFactory, RoleConfigurator, PlayerStats, WolfRole }
}

describe('Game', () => {
  test('constructor ingests initial players and sets stateMachine context', async () => {
    const { Game } = await loadGame()
    const e = makeEvent()
    const stateMachine = makeStateMachine()

    const game = new Game({
      e,
      config: { game: {} },
      players: [{ id: 'u1', isAlive: true, role: 'WOLF', name: 'A' }],
      stateMachine,
      victoryChecker: { checkVictory: jest.fn(() => ({ gameOver: false })) },
      groupId: 1
    })

    expect(game.getPlayerCount()).toBe(1)
    expect(stateMachine.setContext).toHaveBeenCalledWith(game)
  })

  test('addPlayer assigns gameNumber and prevents duplicates', async () => {
    const { Game } = await loadGame()
    const game = new Game({ e: makeEvent(), config: {}, players: [], stateMachine: makeStateMachine(), groupId: 1 })

    const p1 = game.addPlayer({ id: 'u1', isAlive: true, role: 'WOLF', name: 'A' })
    expect(p1.gameNumber).toBe(1)
    expect(game.getPlayerByNumber(1).id).toBe('u1')

    expect(() => game.addPlayer({ id: 'u1' })).toThrow()
  })

  test('notificationCenter facade supports group and private messages', async () => {
    const { Game } = await loadGame()
    const e = makeEvent()
    const game = new Game({ e, config: {}, players: [], stateMachine: makeStateMachine(), groupId: 1 })

    await expect(game.notificationCenter.sendMessage('group', null, 'hello')).resolves.toBe(true)
    expect(e.reply).toHaveBeenCalledWith('hello')

    await expect(game.notificationCenter.sendMessage('private', 'u1', 'hi')).resolves.toBe(true)
    expect(e.bot.pickFriend).toHaveBeenCalledWith('u1')

    await expect(game.notificationCenter.sendMessage('private', null, 'hi')).resolves.toBe(false)
  })

  test('notificationCenter.sendMessage returns false on send errors', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { Game } = await loadGame()
    const e = makeEvent()
    e.reply.mockRejectedValueOnce(new Error('send failed'))
    const game = new Game({ e, config: {}, players: [], stateMachine: makeStateMachine(), groupId: 1 })

    await expect(game.notificationCenter.sendMessage('group', null, 'hello')).resolves.toBe(false)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  test('notificationCenter.handleError formats message and tolerates reply errors', async () => {
    const { Game } = await loadGame()
    const e = makeEvent()
    const game = new Game({ e, config: {}, players: [], stateMachine: makeStateMachine(), groupId: 1 })

    await game.notificationCenter.handleError(new Error('boom'))
    expect(e.reply).toHaveBeenCalledWith('[游戏错误] boom')

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    e.reply.mockRejectedValueOnce(new Error('reply failed'))
    await expect(game.notificationCenter.handleError('x')).resolves.toBeUndefined()
    spy.mockRestore()
  })

  test('player lookup helpers work', async () => {
    const { Game } = await loadGame()
    const game = new Game({
      e: makeEvent(),
      config: {},
      players: [{ id: 'u1', isAlive: true, name: 'A' }],
      stateMachine: makeStateMachine(),
      groupId: 1
    })

    const number = game.getPlayerNumber('u1')
    expect(number).toBe(1)
    expect(game.getPlayerIdByNumber(1)).toBe('u1')
  })

  test('getAlivePlayers supports campType and roleType filters', async () => {
    class WolfRole {}
    class VillagerRole {}

    const { Game } = await loadGame({
      roleCamps: { WOLF: 'WOLF', VILLAGER: 'VILLAGER' }
    })

    const game = new Game({
      e: makeEvent(),
      config: {},
      players: [
        { id: 'u1', isAlive: true, role: 'WOLF', name: 'W' },
        { id: 'u2', isAlive: true, role: 'VILLAGER', name: 'V' },
        { id: 'u3', isAlive: false, role: 'WOLF', name: 'Dead' }
      ],
      stateMachine: makeStateMachine(),
      groupId: 1
    })

    game.roles.set('u1', new WolfRole())
    game.roles.set('u2', new VillagerRole())

    expect(game.getAlivePlayers({ campType: 'WOLF' })).toHaveLength(1)
    expect(game.getAlivePlayers({ roleType: 'VillagerRole' })).toHaveLength(1)
    expect(game.getAlivePlayers({ includeRole: true })[0]).toHaveProperty('role')
  })

  test('sheriff getter returns alive sheriff', async () => {
    const { Game } = await loadGame()
    const game = new Game({
      e: makeEvent(),
      config: {},
      players: [
        { id: 'u1', isAlive: true, isSheriff: true, name: 'S' },
        { id: 'u2', isAlive: true, isSheriff: false, name: 'N' }
      ],
      stateMachine: makeStateMachine(),
      groupId: 1
    })

    expect(game.sheriff.id).toBe('u1')
  })

  test('shuffle returns a new array and handles non-array input', async () => {
    const { Game } = await loadGame()
    const game = new Game({ e: makeEvent(), config: {}, players: [], stateMachine: makeStateMachine(), groupId: 1 })

    expect(game.shuffle(null)).toEqual([])
    const arr = [1, 2, 3]
    const shuffled = game.shuffle(arr)
    expect(shuffled).toHaveLength(3)
    expect(shuffled).not.toBe(arr)
  })

  test('start enforces minPlayers', async () => {
    const { Game } = await loadGame()
    const e = makeEvent()
    const game = new Game({ e, config: { game: { minPlayers: 2 } }, players: [{ id: 'u1', isAlive: true }], stateMachine: makeStateMachine(), groupId: 1 })

    const ok = await game.start()

    expect(ok).toBe(false)
    expect(e.reply).toHaveBeenCalled()
  })

  test('start runs initPlayers + initState and returns true', async () => {
    const { Game, GAME_PHASES } = await loadGame({
      roleConfiguratorGenerate: (count) => Array.from({ length: count }, () => 'WOLF')
    })
    const e = makeEvent()
    const game = new Game({
      e,
      config: { game: { minPlayers: 1 } },
      players: [{ id: 'u1', isAlive: true }],
      stateMachine: makeStateMachine(),
      groupId: 1
    })

    const ok = await game.start()

    expect(ok).toBe(true)
    expect(game.getCurrentPhase()).toBe(GAME_PHASES.NIGHT)
    expect(game.getCurrentTurn()).toBe(0)
  })

  test('initPlayers always uses RoleConfigurator.generate()', async () => {
    const { Game, RoleConfigurator } = await loadGame({
      roleConfiguratorGenerate: (count) => Array.from({ length: count }, () => 'WOLF')
    })

    const game = new Game({
      e: makeEvent(),
      config: {},
      players: [{ id: 'u1', isAlive: true }, { id: 'u2', isAlive: true }],
      stateMachine: makeStateMachine(),
      groupId: 1
    })

    await game.initPlayers()
    expect(RoleConfigurator.generate).toHaveBeenCalledWith(2)
  })

  test('initializePlayerRoles assigns role and normalizes async getCamp', async () => {
    const { Game, RoleFactory } = await loadGame({
      roleFactoryCreateRole: () => ({
        getCamp: async () => 'GOD'
      })
    })

    const game = new Game({
      e: makeEvent(),
      config: {},
      players: [{ id: 'u1', isAlive: true }, { id: 'u2', isAlive: true }],
      stateMachine: makeStateMachine(),
      groupId: 1
    })

    await game.initializePlayerRoles(['WOLF', 'VILLAGER'])

    expect(RoleFactory.createRole).toHaveBeenCalledTimes(2)
    const roleInstance = game.roles.get('u1')
    expect(roleInstance.getCamp.constructor.name).not.toBe('AsyncFunction')
  })

  test('initializeState sets Night phase and keeps turn=0', async () => {
    const { Game, GAME_PHASES } = await loadGame()
    const game = new Game({ e: makeEvent(), config: {}, players: [{ id: 'u1', isAlive: true }], stateMachine: makeStateMachine(), groupId: 1 })

    await game.initializeState()

    expect(game.getCurrentPhase()).toBe(GAME_PHASES.NIGHT)
    expect(game.getCurrentTurn()).toBe(0)
  })

  test('initializeState replies and rethrows when state init fails', async () => {
    const { Game } = await loadGame()
    const e = makeEvent()
    const stateMachine = makeStateMachine()
    stateMachine.changeState = jest.fn(async () => { throw new Error('bad state') })
    const game = new Game({ e, config: {}, players: [{ id: 'u1', isAlive: true }], stateMachine, groupId: 1 })

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(game.initializeState()).rejects.toThrow('bad state')
    spy.mockRestore()
    expect(e.reply).toHaveBeenCalledWith('初始化游戏状态失败，请重新创建游戏。')
  })

  test('changeState pushes history and replies phase message', async () => {
    const { Game, GAME_PHASES } = await loadGame()
    const e = makeEvent()
    const stateMachine = makeStateMachine()

    const game = new Game({ e, config: {}, players: [{ id: 'u1', isAlive: true }], stateMachine, groupId: 1 })

    const newState = {
      getName: () => 'VoteState'
    }
    await game.changeState(newState)

    expect(game.getStateHistory()).toHaveLength(1)
    expect(game.getCurrentPhase()).toBe(GAME_PHASES.DAY_VOTING)
    expect(e.reply).toHaveBeenCalledWith('游戏进入VoteState阶段')
    expect(newState.e).toBe(e)
  })

  test('changeState records from-state when a previous state exists', async () => {
    const { Game } = await loadGame()
    const e = makeEvent()
    const stateMachine = makeStateMachine()
    const game = new Game({ e, config: {}, players: [], stateMachine, groupId: 1 })

    const s1 = { getName: () => 'DayState' }
    const s2 = { getName: () => 'VoteState' }

    await game.changeState(s1)
    await game.changeState(s2)

    const history = game.getStateHistory()
    expect(history).toHaveLength(2)
    expect(history[1].from).toBe('DayState')
    expect(history[1].to).toBe('VoteState')
  })

  test('setStateTransitionContext delegates to stateMachine', async () => {
    const { Game } = await loadGame()
    const stateMachine = makeStateMachine()
    const game = new Game({ e: makeEvent(), config: {}, players: [], stateMachine, groupId: 1 })

    game.setStateTransitionContext({ deadPlayer: { id: 1 } })

    expect(stateMachine.setStateTransitionContext).toHaveBeenCalledWith({ deadPlayer: { id: 1 } })
  })

  test('setStateTransitionContext is a no-op when stateMachine lacks setter', async () => {
    const { Game } = await loadGame()
    const stateMachine = {
      setContext: jest.fn(),
      changeState: jest.fn(async () => {}),
      getCurrentState: jest.fn(() => null)
    }
    const game = new Game({ e: makeEvent(), config: {}, players: [], stateMachine, groupId: 1 })

    expect(() => game.setStateTransitionContext({ any: 1 })).not.toThrow()
  })

  test('isValidAction and state getter reflect current state', async () => {
    const { Game } = await loadGame()
    const stateMachine = makeStateMachine()
    const game = new Game({ e: makeEvent(), config: {}, players: [], stateMachine, groupId: 1 })

    expect(game.isValidAction({}, 'x')).toBe(false)
    expect(game.state).toBe(null)

    const state = { isValidAction: () => true }
    stateMachine.getCurrentState = jest.fn(() => state)
    expect(game.isValidAction({}, 'x')).toBe(true)
    expect(game.state).toBe(state)
  })

  test('handleAction throws on invalid inputs and invalid action', async () => {
    const { Game } = await loadGame()
    const stateMachine = makeStateMachine()
    const game = new Game({ e: makeEvent(), config: {}, players: [], stateMachine, groupId: 1 })

    await expect(game.handleAction(null, 'vote')).rejects.toThrow()
    await expect(game.handleAction({ id: 1 }, 'vote')).rejects.toThrow()

    const state = { isValidAction: () => false, handleAction: jest.fn() }
    stateMachine.getCurrentState = jest.fn(() => state)
    await expect(game.handleAction({ id: 1 }, 'vote')).rejects.toThrow()
  })

  test('handleAction validates current state and delegates to state.handleAction', async () => {
    const { Game } = await loadGame()
    const state = {
      isValidAction: jest.fn(() => true),
      handleAction: jest.fn(async () => true)
    }

    const stateMachine = makeStateMachine()
    stateMachine.getCurrentState = jest.fn(() => state)
    const game = new Game({ e: makeEvent(), config: {}, players: [{ id: 'u1', isAlive: true }], stateMachine, groupId: 1 })

    await game.handleAction({ id: 'u1' }, 'vote', 'u2')

    expect(state.isValidAction).toHaveBeenCalled()
    expect(state.handleAction).toHaveBeenCalledWith(expect.any(Object), 'vote', 'u2')
  })

  test('handlePlayerDeath marks player dead and triggers endGame', async () => {
    const { Game } = await loadGame()
    const game = new Game({ e: makeEvent(), config: {}, players: [{ id: 'u1', isAlive: true }], stateMachine: makeStateMachine(), groupId: 1 })

    const spy = jest.spyOn(game, 'endGame').mockResolvedValue(false)
    const player = game.getPlayerById('u1')
    await game.handlePlayerDeath(player, 'WOLF_KILL')

    expect(player.isAlive).toBe(false)
    expect(player.deathReason).toBe('WOLF_KILL')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  test('handlePlayerDeath returns false when player is null', async () => {
    const { Game } = await loadGame()
    const game = new Game({ e: makeEvent(), config: {}, players: [], stateMachine: makeStateMachine(), groupId: 1 })
    await expect(game.handlePlayerDeath(null, 'WOLF_KILL')).resolves.toBe(false)
  })

  test('startNewDay increments turn and replies', async () => {
    const { Game } = await loadGame()
    const e = makeEvent()
    const game = new Game({ e, config: {}, players: [], stateMachine: makeStateMachine(), groupId: 1 })
    game.turn = 1

    await game.startNewDay()
    expect(game.turn).toBe(2)
    expect(e.reply).toHaveBeenCalledWith('=== 第2天 ===')
  })

  test('endGame returns false when victoryChecker says game continues', async () => {
    const { Game } = await loadGame()
    const victoryChecker = { checkVictory: jest.fn(() => ({ gameOver: false })) }
    const game = new Game({ e: makeEvent(), config: {}, players: [{ id: 'u1', isAlive: true }], stateMachine: makeStateMachine(), victoryChecker, groupId: 1 })

    const ok = await game.endGame()

    expect(ok).toBe(false)
    expect(victoryChecker.checkVictory).toHaveBeenCalledWith(game)
  })

  test('endGame announces winner, updates stats, and schedules cleanup', async () => {
    jest.useFakeTimers()
    const { Game, PlayerStats } = await loadGame()

    const victoryChecker = { checkVictory: jest.fn(() => ({ gameOver: true, winner: '好人', reason: '狼人全部出局' })) }
    const e = makeEvent()
    const game = new Game({ e, config: {}, players: [{ id: 'u1', isAlive: true, role: 'WOLF', name: 'A' }], stateMachine: makeStateMachine(), victoryChecker, groupId: 1 })

    const cleanupSpy = jest.spyOn(game, 'cleanup')
    const ok = await game.endGame()

    expect(ok).toBe(true)
    expect(e.reply).toHaveBeenCalled()
    expect(PlayerStats.updateStats).toHaveBeenCalled()

    jest.advanceTimersByTime(2000)
    expect(cleanupSpy).toHaveBeenCalled()
    jest.useRealTimers()
  })

  test('endGame formats alivePlayers as \"无\" when no alive players', async () => {
    jest.useFakeTimers()
    const { Game } = await loadGame()
    const e = makeEvent()
    const victoryChecker = { checkVictory: jest.fn(() => ({ gameOver: true, winner: '狼人', reason: '好人全部出局' })) }
    const game = new Game({ e, config: {}, players: [{ id: 'u1', isAlive: false, role: 'WOLF', name: 'A' }], stateMachine: makeStateMachine(), victoryChecker, groupId: 1 })

    await expect(game.endGame()).resolves.toBe(true)
    const msg = e.reply.mock.calls[0][0]
    expect(msg).toContain('存活玩家：\n无')
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  test('endGame tolerates PlayerStats update failures', async () => {
    jest.useFakeTimers()
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { Game } = await loadGame({ playerStatsImportThrows: true })

    const victoryChecker = { checkVictory: jest.fn(() => ({ gameOver: true, winner: '狼人', reason: '好人全部出局' })) }
    const game = new Game({ e: makeEvent(), config: {}, players: [{ id: 'u1', isAlive: true, role: 'WOLF', name: 'A' }], stateMachine: makeStateMachine(), victoryChecker, groupId: 1 })

    await expect(game.endGame()).resolves.toBe(true)
    jest.advanceTimersByTime(2000)
    spy.mockRestore()
    jest.useRealTimers()
  })

  test('resource stats, canEndCurrentState and forceEndCurrentState', async () => {
    const { Game } = await loadGame()
    const stateMachine = makeStateMachine()
    const game = new Game({ e: makeEvent(), config: {}, players: [{ id: 'u1', isAlive: true }], stateMachine, groupId: 1 })

    const state = { canEnd: () => false, onTimeout: jest.fn(async () => {}) }
    stateMachine.getCurrentState = jest.fn(() => state)

    expect(game.getResourceStats()).toHaveProperty('playerCount', 1)
    expect(game.canEndCurrentState()).toBe(false)
    await game.forceEndCurrentState()
    expect(state.onTimeout).toHaveBeenCalled()
  })

  test('canEndCurrentState returns true when state has no canEnd', async () => {
    const { Game } = await loadGame()
    const stateMachine = makeStateMachine()
    const game = new Game({ e: makeEvent(), config: {}, players: [], stateMachine, groupId: 1 })
    stateMachine.getCurrentState = jest.fn(() => ({}))
    expect(game.canEndCurrentState()).toBe(true)
  })

  test('canEndCurrentState returns false when there is no current state', async () => {
    const { Game } = await loadGame()
    const stateMachine = makeStateMachine()
    stateMachine.getCurrentState = jest.fn(() => null)
    const game = new Game({ e: makeEvent(), config: {}, players: [], stateMachine, groupId: 1 })

    expect(game.canEndCurrentState()).toBe(false)
  })

  test('cleanup is idempotent and clears internal collections', async () => {
    const { Game } = await loadGame()
    const game = new Game({ e: makeEvent(), config: {}, players: [{ id: 'u1', isAlive: true }], stateMachine: makeStateMachine(), groupId: 1 })

    expect(game.getPlayerCount()).toBe(1)
    game.cleanup()
    expect(game.getPlayerCount()).toBe(0)
    game.cleanup()
    expect(game.getPlayerCount()).toBe(0)
  })

  test('cleanup catches errors during cleanup steps', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { Game } = await loadGame()
    const game = new Game({ e: makeEvent(), config: {}, players: [{ id: 'u1', isAlive: true }], stateMachine: makeStateMachine(), groupId: 1 })

    game.cleanupWolfRoleStatics = () => { throw new Error('boom') }
    game.cleanup()

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  test('cleanupWolfRoleStatics and getWolfVoteStats use WolfRole module', async () => {
    const wolfStats = { voteCount: 3, hasKillTarget: true }
    const { Game, WolfRole } = await loadGame({ wolfStats })
    const game = new Game({ e: makeEvent(), config: {}, players: [], stateMachine: makeStateMachine(), groupId: 1 })

    game.cleanupWolfRoleStatics()
    await new Promise(resolve => setImmediate(resolve))
    expect(WolfRole.cleanup).toHaveBeenCalled()

    const stats = await game.getWolfVoteStats()
    expect(stats).toEqual(wolfStats)
    expect(WolfRole.getStats).toHaveBeenCalled()
  })

  test('getWolfVoteStats returns fallback on promise rejection', async () => {
    const { Game } = await loadGame({ wolfRoleGetStatsThrows: true })
    const game = new Game({ e: makeEvent(), config: {}, players: [], stateMachine: makeStateMachine(), groupId: 1 })

    const stats = await game.getWolfVoteStats()
    expect(stats).toEqual({ voteCount: 0, hasKillTarget: false })
  })

  test('cleanupWolfRoleStatics handles dynamic import rejection', async () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { Game } = await loadGame({ wolfRoleImportThrows: true })
    const game = new Game({ e: makeEvent(), config: {}, players: [], stateMachine: makeStateMachine(), groupId: 1 })

    game.cleanupWolfRoleStatics()
    await new Promise(resolve => setImmediate(resolve))

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
