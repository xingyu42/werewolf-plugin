import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

const mockGetRoleCamp = jest.fn()
const mockCreateRole = jest.fn()
const mockVictoryCheckerConstructor = jest.fn()
const mockRoleConfiguratorGenerate = jest.fn()
const mockUpdateStats = jest.fn()

class MockNightPhaseController {
  constructor (game) {
    this.game = game
    this.e = null
  }

  getName () {
    return 'NightPhaseController'
  }
}

class MockGameError extends Error {
  constructor (message, code = 'E1000', details = {}) {
    super(message)
    this.name = 'GameError'
    this.code = code
    this.details = details
  }
}

jest.unstable_mockModule('../../models/VictoryChecker.js', () => ({
  VictoryChecker: mockVictoryCheckerConstructor
}))

jest.unstable_mockModule('../../models/roles/RoleFactory.js', () => ({
  RoleFactory: {
    getRoleCamp: mockGetRoleCamp,
    createRole: mockCreateRole
  }
}))

jest.unstable_mockModule('../../models/states/NightPhaseController.js', () => ({
  NightPhaseController: MockNightPhaseController
}))

jest.unstable_mockModule('../../utils/configurators/RoleConfigurator.js', () => ({
  RoleConfigurator: {
    generate: mockRoleConfiguratorGenerate
  }
}))

jest.unstable_mockModule('../../utils/GameError.js', () => ({
  GameError: MockGameError
}))

jest.unstable_mockModule('../../utils/PlayerStats.js', () => ({
  default: {
    updateStats: mockUpdateStats
  }
}))

const { Game } = await import('../../models/Game.js')
const { GAME_PHASES, ROLES } = await import('../../models/Constants.js')

class ProphetRole {}
class WolfRole {}

const createEvent = () => ({
  reply: jest.fn(),
  bot: {
    pickFriend: jest.fn(() => ({
      sendMsg: jest.fn()
    }))
  }
})

const createPlayer = ({
  id,
  role = null,
  name = id,
  isAlive = true,
  isSheriff = false,
  gameNumber = null
} = {}) => ({
  id,
  role,
  isAlive,
  isSheriff,
  gameNumber,
  protected: false,
  deathReason: null,
  deathTurn: null,
  get name () {
    return name
  }
})

const createStateMachine = (initialState = null) => {
  const stateMachine = {
    currentState: initialState,
    _pendingState: null,
    setContext: jest.fn(),
    setStateTransitionContext: jest.fn(),
    changeState: jest.fn(async (newState) => {
      stateMachine.currentState = newState
      return true
    }),
    getCurrentState: jest.fn(() => stateMachine.currentState)
  }

  return stateMachine
}

const createNamedState = (name, overrides = {}) => ({
  e: overrides.e,
  getName: jest.fn(() => name),
  onExit: overrides.onExit || jest.fn(),
  handleAction: overrides.handleAction || jest.fn(),
  isValidAction: overrides.isValidAction,
  canEnd: overrides.canEnd,
  onTimeout: overrides.onTimeout
})

const createGame = ({
  e = createEvent(),
  config = { game: { minPlayers: 1 } },
  players = [],
  stateMachine = createStateMachine(),
  victoryChecker = { checkVictory: jest.fn(() => ({ gameOver: false, winner: null, reason: null })) },
  groupId = 'group-1'
} = {}) => new Game({
  e,
  config,
  players,
  stateMachine,
  victoryChecker,
  groupId
})

describe('Game', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockGetRoleCamp.mockImplementation((roleName) => {
      const camps = {
        [ROLES.WOLF]: 'WOLF',
        [ROLES.PROPHET]: 'GOD',
        [ROLES.WITCH]: 'GOD',
        [ROLES.HUNTER]: 'GOD',
        [ROLES.GUARD]: 'GOD',
        [ROLES.VILLAGER]: 'VILLAGER'
      }

      return camps[roleName] || null
    })

    mockCreateRole.mockImplementation((roleName) => ({
      roleName,
      getCamp: jest.fn(() => mockGetRoleCamp(roleName))
    }))

    mockVictoryCheckerConstructor.mockImplementation(() => ({
      checkVictory: jest.fn(() => ({
        gameOver: false,
        winner: null,
        reason: null
      }))
    }))

    mockRoleConfiguratorGenerate.mockReturnValue([ROLES.WOLF])
    mockUpdateStats.mockReturnValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor and player management', () => {
    test('should initialize game fields, context and initial array players', () => {
      const e = createEvent()
      const stateMachine = createStateMachine()
      const victoryChecker = { checkVictory: jest.fn() }
      const players = [
        createPlayer({ id: 'p1' }),
        createPlayer({ id: 'p2' })
      ]

      const game = createGame({
        e,
        players,
        stateMachine,
        victoryChecker,
        groupId: 'group-100'
      })

      expect(game.id).toBe('group-100')
      expect(game.e).toBe(e)
      expect(game.currentPhase).toBe(GAME_PHASES.WAITING)
      expect(game.turn).toBe(0)
      expect(game.getPlayerCount()).toBe(2)
      expect(players[0].gameNumber).toBe(1)
      expect(players[1].gameNumber).toBe(2)
      expect(stateMachine.setContext).toHaveBeenCalledWith(game)
      expect(game.victoryChecker).toBe(victoryChecker)
      expect(game.notificationCenter).toEqual(expect.objectContaining({
        sendMessage: expect.any(Function),
        sendPrivateMessage: expect.any(Function),
        handleError: expect.any(Function),
        cleanup: expect.any(Function)
      }))
    })

    test('should initialize initial players from map', () => {
      const players = new Map([
        ['p1', createPlayer({ id: 'p1' })],
        ['p2', createPlayer({ id: 'p2' })]
      ])

      const game = createGame({ players })

      expect(game.getPlayerCount()).toBe(2)
      expect(game.getPlayerNumber('p1')).toBe(1)
      expect(game.getPlayerNumber('p2')).toBe(2)
    })

    test('should create default victory checker when not provided', () => {
      const game = new Game({
        e: createEvent(),
        config: {},
        players: [],
        stateMachine: createStateMachine(),
        groupId: 'group-1'
      })

      expect(mockVictoryCheckerConstructor).toHaveBeenCalledTimes(1)
      expect(game.victoryChecker).toEqual(expect.objectContaining({
        checkVictory: expect.any(Function)
      }))
    })

    test('should reject invalid or duplicate players', () => {
      const game = createGame()
      const player = createPlayer({ id: 'p1' })

      game.addPlayer(player)

      expect(() => game.addPlayer(null)).toThrow('Invalid player object')
      expect(() => game.addPlayer({ nickname: 'missing id' })).toThrow('Invalid player object')
      expect(() => game.addPlayer(player)).toThrow('该玩家已经在游戏中')
    })

    test('should find players and numbers through public lookup APIs', () => {
      const p1 = createPlayer({ id: 'p1' })
      const p2 = createPlayer({ id: 'p2' })
      const game = createGame({ players: [p1, p2] })

      expect(game.hasPlayer('p1')).toBe(true)
      expect(game.hasPlayer('missing')).toBe(false)
      expect(game.getPlayerById('p2')).toBe(p2)
      expect(game.getPlayerByNumber(1)).toBe(p1)
      expect(game.getPlayerByNumber('2')).toBe(p2)
      expect(game.getPlayerByNumber(99)).toBeNull()
      expect(game.getPlayerIdByNumber(1)).toBe('p1')
      expect(game.getPlayerIdByNumber(99)).toBeNull()
      expect(game.getPlayerNumber('p2')).toBe(2)
      expect(game.getPlayerNumber('missing')).toBeNull()
      expect(game.getAllPlayers()).toBe(game.players)
    })
  })

  describe('player queries and utility helpers', () => {
    test('should return empty array when shuffle input is not an array', () => {
      const game = createGame()

      expect(game.shuffle(null)).toEqual([])
      expect(game.shuffle('abc')).toEqual([])
    })

    test('should shuffle a copy without mutating the original array', () => {
      const game = createGame()
      const input = [1, 2, 3, 4]

      const shuffled = game.shuffle(input)

      expect(shuffled).not.toBe(input)
      expect([...shuffled].sort()).toEqual([1, 2, 3, 4])
      expect(input).toEqual([1, 2, 3, 4])
    })

    test('should return alive sheriff only', () => {
      const deadSheriff = createPlayer({ id: 'p1', isAlive: false, isSheriff: true })
      const aliveSheriff = createPlayer({ id: 'p2', isAlive: true, isSheriff: true })
      const game = createGame({ players: [deadSheriff, aliveSheriff] })

      expect(game.sheriff).toBe(aliveSheriff)
    })

    test('should return null when no alive sheriff exists', () => {
      const game = createGame({
        players: [
          createPlayer({ id: 'p1', isAlive: false, isSheriff: true }),
          createPlayer({ id: 'p2', isAlive: true, isSheriff: false })
        ]
      })

      expect(game.sheriff).toBeNull()
    })

    test('should filter alive players by role, camp and include role instances', () => {
      const wolf = createPlayer({ id: 'p1', role: ROLES.WOLF })
      const prophet = createPlayer({ id: 'p2', role: ROLES.PROPHET })
      const deadVillager = createPlayer({ id: 'p3', role: ROLES.VILLAGER, isAlive: false })
      const game = createGame({ players: [wolf, prophet, deadVillager] })
      const wolfRole = new WolfRole()
      const prophetRole = new ProphetRole()
      game.roles.set(wolf.id, wolfRole)
      game.roles.set(prophet.id, prophetRole)

      expect(game.getAlivePlayers()).toEqual([wolf, prophet])
      expect(game.getAlivePlayers({ campType: 'GOD' })).toEqual([prophet])
      expect(game.getAlivePlayers({ campType: 'WOLF' })).toEqual([wolf])
      expect(game.getAlivePlayers({ roleType: 'ProphetRole' })).toEqual([prophet])
      expect(game.getAlivePlayers({ includeRole: true })).toEqual([
        { player: wolf, role: wolfRole },
        { player: prophet, role: prophetRole }
      ])
      expect(game.getAlivePlayerCount()).toBe(2)
      expect(game.getPlayerRole('p2')).toBe(prophetRole)
      expect(game.getPlayerRole('missing')).toBeNull()
    })

    test('should manage protected status and revive players', () => {
      const p1 = createPlayer({ id: 'p1' })
      const p2 = createPlayer({ id: 'p2' })
      const game = createGame({ players: [p1, p2] })

      expect(game.setProtectedStatus('p1')).toBe(true)
      expect(p1.protected).toBe(true)

      expect(game.setProtectedStatus(p2, false)).toBe(true)
      expect(p2.protected).toBe(false)

      expect(game.setProtectedStatus('missing')).toBe(false)

      p1.protected = true
      p2.protected = true
      game.clearAllProtectedStatus()

      expect(p1.protected).toBe(false)
      expect(p2.protected).toBe(false)

      p1.isAlive = false
      p1.deathReason = 'POISON'
      p1.deathTurn = 3

      expect(game.revivePlayer('p1')).toBe(true)
      expect(p1.isAlive).toBe(true)
      expect(p1.deathReason).toBeNull()
      expect(p1.deathTurn).toBeNull()
      expect(game.revivePlayer('missing')).toBe(false)
    })
  })

  describe('role initialization and game flow', () => {
    test('should initialize player roles with RoleFactory and private notifications', async () => {
      const p1 = createPlayer({ id: 'p1' })
      const p2 = createPlayer({ id: 'p2' })
      const e = createEvent()
      const game = createGame({ e, players: [p1, p2] })
      const role1 = { getCamp: jest.fn(() => 'WOLF') }
      const role2 = { getCamp: async () => 'GOD' }
      mockCreateRole
        .mockReturnValueOnce(role1)
        .mockReturnValueOnce(role2)
      game.shuffle = jest.fn((roles) => roles)
      const sendPrivateSpy = jest
        .spyOn(game.notificationCenter, 'sendPrivateMessage')
        .mockResolvedValue(true)

      await game.initializePlayerRoles([ROLES.WOLF, ROLES.PROPHET])

      expect(game.shuffle).toHaveBeenCalledWith([ROLES.WOLF, ROLES.PROPHET])
      expect(p1.role).toBe(ROLES.WOLF)
      expect(p2.role).toBe(ROLES.PROPHET)
      expect(mockCreateRole).toHaveBeenCalledWith(ROLES.WOLF, game, p1, e)
      expect(mockCreateRole).toHaveBeenCalledWith(ROLES.PROPHET, game, p2, e)
      expect(game.roles.get('p1')).toBe(role1)
      expect(game.roles.get('p2')).toBe(role2)
      expect(game.roles.get('p2').getCamp()).toBe('GOD')
      expect(sendPrivateSpy).toHaveBeenCalledWith('p1', expect.stringContaining('狼人'))
      expect(sendPrivateSpy).toHaveBeenCalledWith('p2', expect.stringContaining('预言家'))
    })

    test('should reject role initialization with invalid role list or count mismatch', async () => {
      const game = createGame({
        players: [
          createPlayer({ id: 'p1' })
        ]
      })

      await expect(game.initializePlayerRoles([])).rejects.toMatchObject({ code: 'E1104' })
      await expect(game.initializePlayerRoles([ROLES.WOLF, ROLES.PROPHET])).rejects.toMatchObject({ code: 'E1104' })
    })

    test('should not start when player count is below configured minimum', async () => {
      const e = createEvent()
      const game = createGame({
        e,
        config: { game: { minPlayers: 2 } },
        players: [createPlayer({ id: 'p1' })]
      })

      await expect(game.start()).resolves.toBe(false)
      expect(e.reply).toHaveBeenCalledWith('游戏人数不足，无法开始（需要 2 人，当前 1 人）。')
    })

    test('should start by initializing players and state when minimum player count is met', async () => {
      const game = createGame({
        config: { game: { minPlayers: 1 } },
        players: [createPlayer({ id: 'p1' })]
      })
      jest.spyOn(game, 'initPlayers').mockResolvedValue()
      jest.spyOn(game, 'initState').mockResolvedValue()

      await expect(game.start()).resolves.toBe(true)
      expect(game.initPlayers).toHaveBeenCalledTimes(1)
      expect(game.initState).toHaveBeenCalledTimes(1)
    })
  })

  describe('state handling', () => {
    test('should delegate changeState to state machine and update current phase', async () => {
      const e = createEvent()
      const stateMachine = createStateMachine()
      const game = createGame({ e, stateMachine })
      const state = createNamedState('DayState')

      await game.changeState(state)

      expect(state.e).toBe(e)
      expect(stateMachine.changeState).toHaveBeenCalledWith(state)
      expect(game.currentState).toBe(state)
      expect(game.currentPhase).toBe(GAME_PHASES.DAY_DISCUSSION)
      expect(game.stateHistory).toHaveLength(1)
      expect(game.stateHistory[0]).toMatchObject({
        from: 'none',
        to: 'DayState',
        turn: 0
      })
    })

    test('should reject empty state and refuse state changes after game over', async () => {
      const stateMachine = createStateMachine()
      const game = createGame({ stateMachine })

      await expect(game.changeState(null)).rejects.toMatchObject({ code: 'E1201' })

      game._isGameOver = true

      await expect(game.changeState(createNamedState('DayState'))).resolves.toBe(false)
      expect(stateMachine.changeState).not.toHaveBeenCalled()
    })

    test('should pass transition context to state machine', () => {
      const stateMachine = createStateMachine()
      const game = createGame({ stateMachine })
      const context = { deadPlayer: { id: 'p1', isSheriff: true } }

      game.setStateTransitionContext(context)

      expect(stateMachine.setStateTransitionContext).toHaveBeenCalledWith(context)
    })

    test('should map state names to current phases', () => {
      const game = createGame()

      game.updateCurrentPhase(createNamedState('NightPhaseController'))
      expect(game.currentPhase).toBe(GAME_PHASES.NIGHT)

      game.updateCurrentPhase(createNamedState('InformationPhaseState'))
      expect(game.currentPhase).toBe(GAME_PHASES.NIGHT)

      game.updateCurrentPhase(createNamedState('VoteState'))
      expect(game.currentPhase).toBe(GAME_PHASES.DAY_VOTING)

      game.updateCurrentPhase(createNamedState('SheriffElectState'))
      expect(game.currentPhase).toBe(GAME_PHASES.SHERIFF_ELECTION)

      const previousPhase = game.currentPhase
      game.updateCurrentPhase(createNamedState('UnknownState'))
      expect(game.currentPhase).toBe(previousPhase)
    })

    test('should validate and delegate player actions to current state', async () => {
      const player = createPlayer({ id: 'p1' })
      const state = createNamedState('DayState', {
        isValidAction: jest.fn(() => true),
        handleAction: jest.fn()
      })
      const game = createGame({
        stateMachine: createStateMachine(state)
      })

      await game.handleAction(player, 'vote', { target: 'p2' })

      expect(state.isValidAction).toHaveBeenCalledWith(player, 'vote', { target: 'p2' })
      expect(state.handleAction).toHaveBeenCalledWith(player, 'vote', { target: 'p2' })
      expect(game.isValidAction(player, 'vote', {})).toBe(true)
    })

    test('should reject invalid handleAction inputs and invalid actions', async () => {
      const player = createPlayer({ id: 'p1' })
      const state = createNamedState('VoteState', {
        isValidAction: jest.fn(() => false),
        handleAction: jest.fn()
      })
      const game = createGame({
        stateMachine: createStateMachine(state)
      })

      await expect(game.handleAction(null, 'vote')).rejects.toMatchObject({ code: 'E1100' })

      game._isGameOver = true
      await expect(game.handleAction(player, 'vote')).rejects.toMatchObject({ code: 'E1201' })

      game._isGameOver = false
      await expect(game.handleAction(player, 'vote')).rejects.toMatchObject({ code: 'E1200' })
      expect(state.handleAction).not.toHaveBeenCalled()
    })

    test('should reject action when current state is missing', async () => {
      const game = createGame({ stateMachine: createStateMachine(null) })

      await expect(game.handleAction(createPlayer({ id: 'p1' }), 'vote')).rejects.toMatchObject({ code: 'E1201' })
      expect(game.isValidAction(createPlayer({ id: 'p1' }), 'vote')).toBe(false)
    })
  })

  describe('death and victory handling', () => {
    test('should mark player dead and return endGame result', async () => {
      const player = createPlayer({ id: 'p1' })
      const game = createGame({ players: [player] })
      game.turn = 5
      jest.spyOn(game, 'endGame').mockResolvedValue(true)

      await expect(game.handlePlayerDeath(player, 'POISON')).resolves.toBe(true)

      expect(player.isAlive).toBe(false)
      expect(player.deathReason).toBe('POISON')
      expect(player.deathTurn).toBe(5)
      expect(game.endGame).toHaveBeenCalledTimes(1)
    })

    test('should return false when handlePlayerDeath target is empty', async () => {
      const game = createGame()

      await expect(game.handlePlayerDeath(null, 'POISON')).resolves.toBe(false)
    })

    test('should not end game when victory checker says game continues', async () => {
      const victoryChecker = {
        checkVictory: jest.fn(() => ({ gameOver: false, winner: null, reason: null }))
      }
      const e = createEvent()
      const game = createGame({ e, victoryChecker })

      await expect(game.endGame()).resolves.toBe(false)

      expect(victoryChecker.checkVictory).toHaveBeenCalledWith(game)
      expect(e.reply).not.toHaveBeenCalled()
      expect(game._isGameOver).toBe(false)
    })

    test('should end game, reply with alive players and schedule cleanup when victory occurs', async () => {
      const aliveWolf = createPlayer({
        id: 'p1',
        role: ROLES.WOLF,
        name: 'Wolf Player',
        isAlive: true
      })
      const deadVillager = createPlayer({
        id: 'p2',
        role: ROLES.VILLAGER,
        name: 'Dead Player',
        isAlive: false
      })
      const victoryChecker = {
        checkVictory: jest.fn(() => ({
          gameOver: true,
          winner: '狼人',
          reason: '好人全部出局'
        }))
      }
      const e = createEvent()
      const timeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation(() => 1)
      const game = createGame({
        e,
        players: [aliveWolf, deadVillager],
        victoryChecker
      })

      await expect(game.endGame()).resolves.toBe(true)

      expect(game._isGameOver).toBe(true)
      expect(e.reply).toHaveBeenCalledWith(expect.stringContaining('游戏结束！狼人阵营胜利！'))
      expect(e.reply).toHaveBeenCalledWith(expect.stringContaining('好人全部出局'))
      expect(e.reply).toHaveBeenCalledWith(expect.stringContaining('1号 Wolf Player（狼人）'))
      expect(e.reply).not.toHaveBeenCalledWith(expect.stringContaining('Dead Player'))
      expect(mockUpdateStats).toHaveBeenCalledWith(game, {
        winner: '狼人',
        reason: '好人全部出局'
      })
      expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000)

      timeoutSpy.mockRestore()
    })

    test('should return true immediately when game already ended', async () => {
      const victoryChecker = {
        checkVictory: jest.fn()
      }
      const game = createGame({ victoryChecker })
      game._isGameOver = true

      await expect(game.endGame()).resolves.toBe(true)
      expect(victoryChecker.checkVictory).not.toHaveBeenCalled()
    })
  })

  describe('misc APIs and cleanup', () => {
    test('should expose current phase, turn, resource stats and state history snapshot', async () => {
      const state = createNamedState('DayState')
      const game = createGame({
        players: [createPlayer({ id: 'p1' })],
        stateMachine: createStateMachine(state)
      })
      game.roles.set('p1', new ProphetRole())
      game.eventErrors.push(new Error('test'))
      game.stateHistory.push({ from: 'none', to: 'DayState' })

      expect(game.getCurrentState()).toBe(state)
      expect(game.state).toBe(state)
      expect(game.getCurrentPhase()).toBe(GAME_PHASES.WAITING)
      expect(game.getCurrentTurn()).toBe(0)

      await game.incrementTurn()

      expect(game.getCurrentTurn()).toBe(1)
      expect(game.getResourceStats()).toEqual({
        playerCount: 1,
        roleCount: 1,
        eventErrorCount: 1,
        currentPhase: GAME_PHASES.WAITING,
        currentTurn: 1
      })

      const history = game.getStateHistory()
      history.push({ from: 'external' })

      expect(game.stateHistory).toHaveLength(1)
    })

    test('should start new day and notify group', async () => {
      const e = createEvent()
      const game = createGame({ e })

      await game.startNewDay()

      expect(game.turn).toBe(1)
      expect(e.reply).toHaveBeenCalledWith('=== 第1天 ===')
    })

    test('should report whether current state can end and force timeout', async () => {
      const state = createNamedState('VoteState', {
        canEnd: jest.fn(() => false),
        onTimeout: jest.fn()
      })
      const game = createGame({
        stateMachine: createStateMachine(state)
      })

      expect(game.canEndCurrentState()).toBe(false)

      await game.forceEndCurrentState()

      expect(state.onTimeout).toHaveBeenCalledTimes(1)
    })

    test('should return safe values when current state is missing for end helpers', async () => {
      const game = createGame({
        stateMachine: createStateMachine(null)
      })

      expect(game.canEndCurrentState()).toBe(false)
      await expect(game.forceEndCurrentState()).resolves.toBeUndefined()
    })

    test('should cleanup resources idempotently', async () => {
      const state = createNamedState('DayState', {
        onExit: jest.fn()
      })
      const stateMachine = createStateMachine(state)
      const game = createGame({
        players: [createPlayer({ id: 'p1' })],
        stateMachine
      })
      game.roles.set('p1', new ProphetRole())
      game.eventErrors.push(new Error('test'))
      game.notificationCenter.cleanup = jest.fn()
      game.cleanupWolfRoleStatics = jest.fn()

      await game.cleanup()
      await game.cleanup()

      expect(state.onExit).toHaveBeenCalledTimes(1)
      expect(stateMachine.currentState).toBeNull()
      expect(stateMachine._pendingState).toBeNull()
      expect(game.cleanupWolfRoleStatics).toHaveBeenCalledTimes(1)
      expect(game.notificationCenter.cleanup).toHaveBeenCalledTimes(1)
      expect(game.getPlayerCount()).toBe(0)
      expect(game.roles.size).toBe(0)
      expect(game.playerNumberMap.size).toBe(0)
      expect(game.eventErrors).toHaveLength(0)
    })
  })

  describe('notification facade', () => {
    test('should send group and private messages through notification center', async () => {
      const e = createEvent()
      const game = createGame({ e })

      const groupResult = await game.notificationCenter.sendMessage('group', null, '群消息')
      expect(groupResult).toBe(true)
      expect(e.reply).toHaveBeenCalledWith('群消息')

      const privateResult = await game.notificationCenter.sendMessage('private', 'target-id', '私聊')
      expect(privateResult).toBe(true)

      const unknownResult = await game.notificationCenter.sendMessage('unknown', null, 'test')
      expect(unknownResult).toBe(false)
    })

    test('should send private message via facade shortcut', async () => {
      const e = createEvent()
      const game = createGame({ e })

      const result = await game.notificationCenter.sendPrivateMessage('p1', '测试私聊')
      expect(result).toBe(true)
    })

    test('should handle errors through notification center', async () => {
      const e = createEvent()
      const game = createGame({ e })

      await game.notificationCenter.handleError(new Error('测试错误'))
      expect(e.reply).toHaveBeenCalledWith('[游戏错误] 测试错误')

      await game.notificationCenter.handleError('字符串错误')
      expect(e.reply).toHaveBeenCalledWith('[游戏错误] 字符串错误')
    })

    test('should handle notification failure gracefully', async () => {
      const e = createEvent()
      e.reply = jest.fn(() => { throw new Error('reply failed') })
      const game = createGame({ e })
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const result = await game.notificationCenter.sendMessage('group', null, 'fail')
      expect(result).toBe(false)

      consoleSpy.mockRestore()
    })

    test('should provide playerManager facade with correct references', () => {
      const p1 = createPlayer({ id: 'p1' })
      const game = createGame({ players: [p1] })

      expect(game.playerManager.getPlayerById('p1')).toBe(p1)
      expect(game.playerManager.getAllPlayers()).toBe(game.players)
      expect(game.playerManager.roles).toBe(game.roles)
    })
  })

  describe('additional game flow coverage', () => {
    test('should get config reference', () => {
      const config = { game: { minPlayers: 6 } }
      const game = createGame({ config })

      expect(game.getConfig()).toBe(config)
    })

    test('should expose state alias', () => {
      const state = createNamedState('DayState')
      const game = createGame({ stateMachine: createStateMachine(state) })

      expect(game.state).toBe(state)
    })

    test('should handle cleanup with state onExit failure', async () => {
      const state = createNamedState('DayState', {
        onExit: jest.fn(() => { throw new Error('exit failed') })
      })
      const stateMachine = createStateMachine(state)
      const game = createGame({ stateMachine })
      game.cleanupWolfRoleStatics = jest.fn()
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      await game.cleanup()

      expect(game._isCleanedUp).toBe(true)
      consoleSpy.mockRestore()
    })

    test('should handle endGame with no alive players', async () => {
      const deadPlayer = createPlayer({ id: 'p1', role: 'WOLF', isAlive: false })
      const victoryChecker = {
        checkVictory: jest.fn(() => ({
          gameOver: true,
          winner: '好人',
          reason: '狼人全部出局'
        }))
      }
      const e = createEvent()
      const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(() => 1)
      const game = createGame({ e, players: [deadPlayer], victoryChecker })

      await game.endGame()

      expect(e.reply).toHaveBeenCalledWith(expect.stringContaining('存活玩家：\n无'))
      timeoutSpy.mockRestore()
    })
  })
})
