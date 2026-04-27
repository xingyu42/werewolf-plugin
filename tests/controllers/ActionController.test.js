import { jest, describe, beforeEach, test, expect } from '@jest/globals'

const mockGameController = {
  getGame: jest.fn(),
  getGameByPlayer: jest.fn()
}

const mockValidationUtils = {
  validateGamePlayer: jest.fn(),
  validatePlayer: jest.fn(),
  validateGameState: jest.fn()
}

class MockGameError extends Error {}
class MockVoteState {}
class MockLastWordsState {}
class MockSheriffElectState {}
class MockSheriffTransferState {}
class MockDayState {}

const mockActions = {
  VOTE: 'vote',
  ABSTAIN: 'abstain',
  SKIP: 'skip',
  REGISTER: 'register',
  TRANSFER: 'transfer',
  GIVEUP: 'giveup',
  END_SPEECH: 'endSpeech',
  PROTECT: 'protect',
  CHECK: 'check',
  POISON: 'poison',
  SAVE: 'save',
  KILL: 'kill',
  SUICIDE: 'suicide'
}

jest.unstable_mockModule('../../controllers/GameController.js', () => ({
  GameController: mockGameController
}))

jest.unstable_mockModule('../../utils/Validator.js', () => ({
  ValidationUtils: mockValidationUtils
}))

jest.unstable_mockModule('../../utils/GameError.js', () => ({
  GameError: MockGameError
}))

jest.unstable_mockModule('../../models/Constants.js', () => ({
  ACTIONS: mockActions
}))

jest.unstable_mockModule('../../models/states/VoteState.js', () => ({
  VoteState: MockVoteState
}))

jest.unstable_mockModule('../../models/states/LastWordsState.js', () => ({
  LastWordsState: MockLastWordsState
}))

jest.unstable_mockModule('../../models/states/SheriffElectState.js', () => ({
  SheriffElectState: MockSheriffElectState
}))

jest.unstable_mockModule('../../models/states/SheriffTransferState.js', () => ({
  SheriffTransferState: MockSheriffTransferState
}))

jest.unstable_mockModule('../../models/states/DayState.js', () => ({
  DayState: MockDayState
}))

const { ActionController } = await import('../../controllers/ActionController.js')

const createEvent = (overrides = {}) => ({
  group_id: 1001,
  user_id: 'u1',
  reply: jest.fn(),
  bot: {
    fl: {
      has: jest.fn()
    },
    pickFriend: jest.fn()
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

const createGameFixture = () => {
  const player = {
    id: 'u1',
    name: '玩家1',
    isAlive: true,
    isSheriff: false
  }
  const sheriff = {
    ...player,
    isSheriff: true
  }
  const target = {
    id: 'u2',
    name: '玩家2',
    isAlive: true
  }
  const state = {
    isValidAction: jest.fn(() => true),
    getInvalidActionReason: jest.fn(() => '禁止行动')
  }
  const game = {
    stateMachine: {
      getCurrentState: jest.fn(() => state)
    },
    getPlayerByNumber: jest.fn(number => String(number) === '2' ? target : null),
    handleAction: jest.fn(() => Promise.resolve(true)),
    handlePlayerDeath: jest.fn(() => Promise.resolve(true)),
    roles: new Map()
  }

  return {
    player,
    sheriff,
    target,
    state,
    game
  }
}

describe('ActionController', () => {
  let e
  let fixture

  beforeEach(() => {
    jest.clearAllMocks()
    e = createEvent()
    fixture = createGameFixture()
    mockGameController.getGame.mockReturnValue(fixture.game)
    mockGameController.getGameByPlayer.mockReturnValue(null)
    mockValidationUtils.validateGamePlayer.mockReturnValue({
      isValid: true,
      player: fixture.player
    })
    mockValidationUtils.validatePlayer.mockReturnValue({
      isValid: true
    })
    mockValidationUtils.validateGameState.mockReturnValue({
      isValid: true
    })
  })

  test('_getGameOrReply should prefer group game and fallback to player game', () => {
    expect(ActionController._getGameOrReply(e)).toBe(fixture.game)
    expect(mockGameController.getGame).toHaveBeenCalledWith(1001)

    const playerGame = createGameFixture().game
    mockGameController.getGame.mockReturnValueOnce(null)
    mockGameController.getGameByPlayer.mockReturnValueOnce(playerGame)

    expect(ActionController._getGameOrReply(e)).toBe(playerGame)
    expect(mockGameController.getGameByPlayer).toHaveBeenCalledWith('u1')
  })

  test('_getGameOrReply should reply when no game exists', () => {
    mockGameController.getGame.mockReturnValue(null)
    mockGameController.getGameByPlayer.mockReturnValue(null)

    expect(ActionController._getGameOrReply(e)).toBeNull()
    expect(e.reply).toHaveBeenCalledWith('当前群没有进行中的游戏。')
  })

  test('_getPlayerOrReply should reply validation error', () => {
    mockValidationUtils.validateGamePlayer.mockReturnValueOnce({
      isValid: false,
      error: {
        message: '未参赛'
      }
    })

    expect(ActionController._getPlayerOrReply(e, fixture.game)).toBeNull()
    expect(e.reply).toHaveBeenCalledWith('未参赛')
  })

  test('_assertAliveOrReply and _assertStateOrReply should reply validation errors', () => {
    mockValidationUtils.validatePlayer.mockReturnValueOnce({
      isValid: false,
      error: {
        message: '你已死亡'
      }
    })
    expect(ActionController._assertAliveOrReply(e, fixture.player)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('你已死亡')

    mockValidationUtils.validateGameState.mockReturnValueOnce({
      isValid: false,
      error: {
        message: '阶段错误'
      }
    })
    expect(ActionController._assertStateOrReply(e, fixture.game, [MockVoteState])).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('阶段错误')
  })

  test('_assertActionAllowedOrReply should allow missing validator and reject invalid actions', () => {
    fixture.game.stateMachine.getCurrentState.mockReturnValueOnce({})
    expect(ActionController._assertActionAllowedOrReply(e, fixture.game, fixture.player, 'vote')).toBe(true)

    fixture.state.isValidAction.mockReturnValueOnce(false)
    expect(ActionController._assertActionAllowedOrReply(e, fixture.game, fixture.player, 'vote')).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('禁止行动')
  })

  test('vote should dispatch vote action to target', () => {
    expect(ActionController.vote(e, 2)).toBe(true)

    expect(mockValidationUtils.validateGameState).toHaveBeenCalledWith(fixture.game, [MockVoteState])
    expect(fixture.game.getPlayerByNumber).toHaveBeenCalledWith(2)
    expect(fixture.state.isValidAction).toHaveBeenCalledWith(fixture.player, 'vote', 'u2')
    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.player, 'vote', 'u2')
  })

  test('vote should parse target from message and reject missing target', () => {
    e.msg = '#投票2号'
    expect(ActionController.vote(e)).toBe(true)
    expect(fixture.game.getPlayerByNumber).toHaveBeenCalledWith('2')

    fixture.game.getPlayerByNumber.mockReturnValueOnce(null)
    expect(ActionController.vote(createEvent(), 9)).toBe(false)
    expect(e.reply).toHaveBeenCalledTimes(0)
  })

  test('vote should stop when player validation, alive validation or state validation fails', () => {
    mockValidationUtils.validateGamePlayer.mockReturnValueOnce({
      isValid: false,
      error: {
        message: '不在游戏'
      }
    })
    expect(ActionController.vote(e, 2)).toBe(false)
    expect(fixture.game.handleAction).not.toHaveBeenCalled()

    mockValidationUtils.validateGamePlayer.mockReturnValue({
      isValid: true,
      player: fixture.player
    })
    mockValidationUtils.validatePlayer.mockReturnValueOnce({
      isValid: false,
      error: {
        message: '死亡'
      }
    })
    expect(ActionController.vote(e, 2)).toBe(false)

    mockValidationUtils.validatePlayer.mockReturnValue({
      isValid: true
    })
    mockValidationUtils.validateGameState.mockReturnValueOnce({
      isValid: false,
      error: {
        message: '不是投票阶段'
      }
    })
    expect(ActionController.vote(e, 2)).toBe(false)
  })

  test('vote should reply GameError from async handleAction rejection', async () => {
    fixture.game.handleAction.mockReturnValueOnce(Promise.reject(new MockGameError('投票失败')))

    expect(ActionController.vote(e, 2)).toBe(true)
    await Promise.resolve()

    expect(e.reply).toHaveBeenCalledWith('投票失败')
  })

  test('abstain and handleSkip should dispatch actions', () => {
    expect(ActionController.abstain(e)).toBe(true)
    expect(mockValidationUtils.validateGameState).toHaveBeenLastCalledWith(fixture.game, [MockVoteState])
    expect(fixture.game.handleAction).toHaveBeenLastCalledWith(fixture.player, 'abstain')

    expect(ActionController.handleSkip(e)).toBe(true)
    expect(mockValidationUtils.validateGameState).toHaveBeenLastCalledWith(fixture.game, [MockLastWordsState])
    expect(fixture.game.handleAction).toHaveBeenLastCalledWith(fixture.player, 'skip')
  })

  test('sheriffElect should dispatch register action', () => {
    expect(ActionController.sheriffElect(e)).toBe(true)

    expect(mockValidationUtils.validateGameState).toHaveBeenCalledWith(fixture.game, [MockSheriffElectState])
    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.player, 'register')
  })

  test('sheriffTransfer should require sheriff and valid target', () => {
    expect(ActionController.sheriffTransfer(e, 2)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('只有警长可以移交警徽')

    mockValidationUtils.validateGamePlayer.mockReturnValue({
      isValid: true,
      player: fixture.sheriff
    })
    expect(ActionController.sheriffTransfer(e, 2)).toBe(true)
    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.sheriff, 'transfer', 'u2')

    fixture.game.getPlayerByNumber.mockReturnValueOnce(null)
    expect(ActionController.sheriffTransfer(e, 9)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('目标玩家不存在，请指定正确的玩家编号。')
  })

  test('giveupTransfer should require sheriff and dispatch giveup', () => {
    expect(ActionController.giveupTransfer(e)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('只有警长可以放弃移交警徽')

    mockValidationUtils.validateGamePlayer.mockReturnValue({
      isValid: true,
      player: fixture.sheriff
    })
    expect(ActionController.giveupTransfer(e)).toBe(true)
    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.sheriff, 'giveup')
  })

  test('support should dispatch vote action for sheriff election target', () => {
    expect(ActionController.support(e, 2)).toBe(true)

    expect(mockValidationUtils.validateGameState).toHaveBeenCalledWith(fixture.game, [MockSheriffElectState])
    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.player, 'vote', 'u2')
  })

  test('support should reject invalid target', () => {
    fixture.game.getPlayerByNumber.mockReturnValueOnce(null)

    expect(ActionController.support(e, 9)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('目标玩家不存在，请指定正确的玩家编号。')
  })

  test('wolfDiscuss should reject empty content and dispatch discussion content', () => {
    e.msg = '#讨论   '
    expect(ActionController.wolfDiscuss(e)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('讨论内容不能为空')

    expect(ActionController.wolfDiscuss(e, '今晚刀2号')).toBe(true)
    expect(fixture.state.isValidAction).toHaveBeenCalledWith(fixture.player, 'discuss', '今晚刀2号')
    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.player, 'discuss', '今晚刀2号')
  })

  test('wolfReadyVote should dispatch ready_vote action', () => {
    expect(ActionController.wolfReadyVote(e)).toBe(true)

    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.player, 'ready_vote')
  })

  test('endSpeech should reject missing current state', () => {
    fixture.game.stateMachine.getCurrentState.mockReturnValueOnce(null)

    expect(ActionController.endSpeech(e)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('游戏尚未开始或已结束')
  })

  test('endSpeech should use DayState handleEndSpeech when available', async () => {
    const dayState = new MockDayState()
    dayState.handleEndSpeech = jest.fn(() => Promise.resolve(true))
    fixture.game.stateMachine.getCurrentState.mockReturnValue(dayState)

    expect(ActionController.endSpeech(e)).toBe(true)
    await Promise.resolve()

    expect(dayState.handleEndSpeech).toHaveBeenCalledWith(fixture.player)
    expect(fixture.game.handleAction).not.toHaveBeenCalled()
  })

  test('endSpeech should dispatch generic endSpeech action outside DayState', () => {
    expect(ActionController.endSpeech(e)).toBe(true)

    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.player, 'endSpeech')
  })

  test('roleAction should map supported role actions and optional targets', () => {
    expect(ActionController.roleAction(e, 'check', 2)).toBe(true)
    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.player, 'check', 'u2')

    expect(ActionController.roleAction(e, 'skip')).toBe(true)
    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.player, 'skip', null)
  })

  test('roleAction should reject unknown action and invalid target', () => {
    expect(ActionController.roleAction(e, 'unknown', 2)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('未知技能类型')

    fixture.game.getPlayerByNumber.mockReturnValueOnce(null)
    expect(ActionController.roleAction(e, 'kill', 9)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('目标玩家不存在，请指定正确的玩家编号。')
  })

  test('roleAction should delegate shoot action to shoot method', async () => {
    const shootSpy = jest.spyOn(ActionController, 'shoot').mockResolvedValueOnce(true)

    await expect(ActionController.roleAction(e, 'shoot', 2)).resolves.toBe(true)
    expect(shootSpy).toHaveBeenCalledWith(e, 2)

    shootSpy.mockRestore()
  })

  test('shoot should require HunterRole', async () => {
    fixture.game.roles.set('u1', {
      constructor: {
        name: 'VillagerRole'
      }
    })

    await expect(ActionController.shoot(e, 2)).resolves.toBe(false)
    expect(e.reply).toHaveBeenCalledWith('只有猎人可以开枪')
  })

  test('shoot should reject hunter that cannot act', async () => {
    class HunterRole {
      canAct () {
        return false
      }
    }
    fixture.game.roles.set('u1', new HunterRole())

    await expect(ActionController.shoot(e, 2)).resolves.toBe(false)
    expect(e.reply).toHaveBeenCalledWith('当前无法开枪')
  })

  test('shoot should validate target number and target state', async () => {
    class HunterRole {
      canAct () {
        return true
      }
    }
    fixture.game.roles.set('u1', new HunterRole())

    await expect(ActionController.shoot(e)).resolves.toBe(false)
    expect(e.reply).toHaveBeenCalledWith('请指定正确的玩家编号。')

    fixture.game.getPlayerByNumber.mockReturnValueOnce(null)
    await expect(ActionController.shoot(e, 9)).resolves.toBe(false)
    expect(e.reply).toHaveBeenCalledWith('目标玩家不存在，请指定正确的玩家编号。')

    fixture.game.getPlayerByNumber.mockReturnValueOnce({
      id: 'u2',
      name: '玩家2',
      isAlive: false
    })
    await expect(ActionController.shoot(e, 2)).resolves.toBe(false)
    expect(e.reply).toHaveBeenCalledWith('目标玩家已死亡')

    fixture.game.getPlayerByNumber.mockReturnValueOnce({
      id: 'u1',
      name: '玩家1',
      isAlive: true
    })
    await expect(ActionController.shoot(e, 1)).resolves.toBe(false)
    expect(e.reply).toHaveBeenCalledWith('不能对自己开枪')
  })

  test('shoot should kill target, disable canShoot and reply success', async () => {
    class HunterRole {
      constructor () {
        this.canShoot = true
      }

      canAct () {
        return true
      }
    }
    const role = new HunterRole()
    fixture.game.roles.set('u1', role)

    await expect(ActionController.shoot(e, 2)).resolves.toBe(true)

    expect(role.canShoot).toBe(false)
    expect(fixture.game.handlePlayerDeath).toHaveBeenCalledWith(fixture.target, 'HUNTER_SHOT')
    expect(e.reply).toHaveBeenCalledWith('猎人 玩家1 开枪射杀了 玩家2')
  })

  test('shoot should reply GameError message when death handling fails', async () => {
    class HunterRole {
      canAct () {
        return true
      }
    }
    fixture.game.roles.set('u1', new HunterRole())
    fixture.game.handlePlayerDeath.mockRejectedValueOnce(new MockGameError('不能开枪'))

    await expect(ActionController.shoot(e, 2)).resolves.toBe(false)

    expect(e.reply).toHaveBeenCalledWith('不能开枪')
  })

  test('abstain async error should reply generic message for non-GameError', async () => {
    fixture.game.handleAction.mockReturnValueOnce(Promise.reject(new Error('generic fail')))

    expect(ActionController.abstain(e)).toBe(true)
    await Promise.resolve()

    expect(e.reply).toHaveBeenCalledWith('操作失败，发生了未知错误。')
  })

  test('handleSkip should reject when alive check fails', () => {
    mockValidationUtils.validateGamePlayer.mockReturnValueOnce({
      isValid: false,
      error: { message: '不在游戏中' }
    })

    expect(ActionController.handleSkip(e)).toBe(false)
  })

  test('sheriffElect should reject when no game exists', () => {
    mockGameController.getGame.mockReturnValueOnce(null)
    mockGameController.getGameByPlayer.mockReturnValueOnce(null)

    expect(ActionController.sheriffElect(e)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('当前群没有进行中的游戏。')
  })

  test('support should reject when no game exists', () => {
    mockGameController.getGame.mockReturnValueOnce(null)
    mockGameController.getGameByPlayer.mockReturnValueOnce(null)

    expect(ActionController.support(e, 2)).toBe(false)
  })

  test('wolfDiscuss should reject when no game exists', () => {
    mockGameController.getGame.mockReturnValueOnce(null)
    mockGameController.getGameByPlayer.mockReturnValueOnce(null)

    expect(ActionController.wolfDiscuss(e, '刀2号')).toBe(false)
  })

  test('wolfReadyVote should reject when no game exists', () => {
    mockGameController.getGame.mockReturnValueOnce(null)
    mockGameController.getGameByPlayer.mockReturnValueOnce(null)

    expect(ActionController.wolfReadyVote(e)).toBe(false)
  })

  test('endSpeech should reject when no game exists', () => {
    mockGameController.getGame.mockReturnValueOnce(null)
    mockGameController.getGameByPlayer.mockReturnValueOnce(null)

    expect(ActionController.endSpeech(e)).toBe(false)
  })

  test('roleAction should reject when no game exists', () => {
    mockGameController.getGame.mockReturnValueOnce(null)
    mockGameController.getGameByPlayer.mockReturnValueOnce(null)

    expect(ActionController.roleAction(e, 'check', 2)).toBe(false)
  })

  test('roleAction should map guard and protect correctly', () => {
    expect(ActionController.roleAction(e, 'guard', 2)).toBe(true)
    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.player, 'protect', 'u2')

    expect(ActionController.roleAction(e, 'protect', 2)).toBe(true)
    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.player, 'protect', 'u2')
  })

  test('roleAction should handle suicide action', () => {
    expect(ActionController.roleAction(e, 'suicide')).toBe(true)
    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.player, 'suicide', null)
  })

  test('roleAction should handle save and poison actions', () => {
    expect(ActionController.roleAction(e, 'save')).toBe(true)
    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.player, 'save', null)

    expect(ActionController.roleAction(e, 'poison', 2)).toBe(true)
    expect(fixture.game.handleAction).toHaveBeenCalledWith(fixture.player, 'poison', 'u2')
  })
})
