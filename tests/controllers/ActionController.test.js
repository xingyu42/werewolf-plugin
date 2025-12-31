import { jest } from '@jest/globals'

function makeEvent (overrides = {}) {
  return {
    group_id: 100,
    user_id: 1,
    msg: '',
    reply: jest.fn(),
    ...overrides
  }
}

async function loadActionController ({
  game = null,
  validateGamePlayer = () => ({ isValid: true, player: { id: 1, isAlive: true, name: 'P1', isSheriff: false } }),
  validatePlayer = () => ({ isValid: true }),
  validateGameState = () => ({ isValid: true })
} = {}) {
  jest.resetModules()

  class VoteState {}
  class LastWordsState {}
  class SheriffElectState {}
  class SheriffTransferState {}
  class DayState {}

  const ValidationUtils = {
    validateGamePlayer: jest.fn(validateGamePlayer),
    validatePlayer: jest.fn(validatePlayer),
    validateGameState: jest.fn(validateGameState)
  }

  jest.unstable_mockModule('../../controllers/GameController.js', () => ({
    GameController: {
      getGame: jest.fn(() => game)
    }
  }))
  jest.unstable_mockModule('../../utils/Validator.js', () => ({
    ValidationUtils
  }))

  jest.unstable_mockModule('../../models/states/VoteState.js', () => ({ VoteState }))
  jest.unstable_mockModule('../../models/states/LastWordsState.js', () => ({ LastWordsState }))
  jest.unstable_mockModule('../../models/states/SheriffElectState.js', () => ({ SheriffElectState }))
  jest.unstable_mockModule('../../models/states/SheriffTransferState.js', () => ({ SheriffTransferState }))
  jest.unstable_mockModule('../../models/states/DayState.js', () => ({ DayState }))

  const { ActionController } = await import('../../controllers/ActionController.js')
  const { ACTIONS } = await import('../../models/Constants.js')
  const { GameError } = await import('../../utils/GameError.js')

  return {
    ActionController,
    ValidationUtils,
    VoteState,
    LastWordsState,
    SheriffElectState,
    SheriffTransferState,
    DayState,
    ACTIONS,
    GameError
  }
}

describe('ActionController', () => {
  test('_getGameOrReply replies when no game', async () => {
    const { ActionController } = await loadActionController({ game: null })
    const e = makeEvent()

    const res = ActionController._getGameOrReply(e)

    expect(res).toBe(null)
    expect(e.reply).toHaveBeenCalledWith('当前群没有进行中的游戏。')
  })

  test('vote calls handleAction on success', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(() => Promise.resolve()),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }

    const { ActionController, ACTIONS } = await loadActionController({ game })
    const e = makeEvent({ msg: '#投票 2号' })

    const ok = ActionController.vote(e, 2)

    expect(ok).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), ACTIONS.VOTE, 2)
  })

  test('vote replies when target is missing', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => null),
      handleAction: jest.fn(() => Promise.resolve()),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }

    const { ActionController } = await loadActionController({ game })
    const e = makeEvent()

    const ok = ActionController.vote(e, 99)

    expect(ok).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('目标玩家不存在，请指定正确的玩家编号。')
  })

  test('vote parses target number from message when not provided', async () => {
    const game = {
      getPlayerByNumber: jest.fn((num) => ({ id: Number(num), isAlive: true, name: `P${num}` })),
      handleAction: jest.fn(() => Promise.resolve()),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }

    const { ActionController, ACTIONS } = await loadActionController({ game })
    const e = makeEvent({ msg: '#投票 2号' })

    expect(ActionController.vote(e)).toBe(true)
    expect(game.getPlayerByNumber).toHaveBeenCalledWith('2')
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), ACTIONS.VOTE, 2)
  })

  test('vote catches GameError and replies error message', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(() => Promise.reject(new (class extends Error { })('nope'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }

    const { ActionController, GameError } = await loadActionController({ game })
    game.handleAction.mockRejectedValueOnce(new GameError('bad', 'E1200'))
    const e = makeEvent()

    expect(ActionController.vote(e, 2)).toBe(true)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('bad')
  })

  test('vote catch replies fallback message for non-GameError', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.vote(e, 2)).toBe(true)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('操作失败，发生了未知错误。')
  })

  test('abstain calls handleAction', async () => {
    const game = {
      handleAction: jest.fn(() => Promise.resolve()),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController, ACTIONS } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.abstain(e)).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), ACTIONS.ABSTAIN)
  })

  test('abstain catches rejection and replies fallback message', async () => {
    const game = {
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.abstain(e)).toBe(true)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('操作失败，发生了未知错误。')
  })

  test('abstain catches GameError and replies message', async () => {
    const game = {
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController, GameError } = await loadActionController({ game })
    game.handleAction.mockRejectedValueOnce(new GameError('abstain failed', 'E1200'))
    const e = makeEvent()

    expect(ActionController.abstain(e)).toBe(true)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('abstain failed')
  })

  test('handleSkip catches GameError and replies', async () => {
    const game = {
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController, GameError, ACTIONS } = await loadActionController({ game })
    game.handleAction.mockRejectedValueOnce(new GameError('skip failed', 'E1200'))
    const e = makeEvent()

    expect(ActionController.handleSkip(e)).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), ACTIONS.SKIP)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('skip failed')
  })

  test('handleSkip replies fallback message for non-GameError', async () => {
    const game = {
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController, ACTIONS } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.handleSkip(e)).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), ACTIONS.SKIP)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('操作失败，发生了未知错误。')
  })

  test('sheriffElect forwards REGISTER action', async () => {
    const game = {
      handleAction: jest.fn(() => Promise.resolve()),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController, ACTIONS } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.sheriffElect(e)).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), ACTIONS.REGISTER)
  })

  test('sheriffElect catches rejection and replies', async () => {
    const game = {
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController, GameError } = await loadActionController({ game })
    game.handleAction.mockRejectedValueOnce(new GameError('elect failed', 'E1400'))
    const e = makeEvent()

    expect(ActionController.sheriffElect(e)).toBe(true)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('elect failed')
  })

  test('sheriffElect replies fallback message for non-GameError', async () => {
    const game = {
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.sheriffElect(e)).toBe(true)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('操作失败，发生了未知错误。')
  })

  test('sheriffTransfer enforces sheriff-only', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(() => Promise.resolve()),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }

    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player: { id: 1, isAlive: true, isSheriff: false, name: 'P1' } })
    })
    const e = makeEvent()

    expect(ActionController.sheriffTransfer(e, 2)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('只有警长可以移交警徽')
  })

  test('sheriffTransfer catches rejection and replies', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }

    const { ActionController, GameError, ACTIONS } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player: { id: 1, isAlive: true, isSheriff: true, name: 'P1' } })
    })
    game.handleAction.mockRejectedValueOnce(new GameError('transfer failed', 'E1200'))
    const e = makeEvent()

    expect(ActionController.sheriffTransfer(e, 2)).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), ACTIONS.TRANSFER, 2)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('transfer failed')
  })

  test('sheriffTransfer replies fallback message for non-GameError', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player: { id: 1, isAlive: true, isSheriff: true, name: 'P1' } })
    })
    const e = makeEvent()

    expect(ActionController.sheriffTransfer(e, 2)).toBe(true)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('操作失败，发生了未知错误。')
  })

  test('giveupTransfer rejects when not sheriff', async () => {
    const game = { handleAction: jest.fn(), stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) } }
    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player: { id: 1, isAlive: true, isSheriff: false, name: 'P1' } })
    })
    const e = makeEvent()

    expect(ActionController.giveupTransfer(e)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('只有警长可以放弃移交警徽')
  })

  test('giveupTransfer forwards GIVEUP and catches rejection', async () => {
    const game = {
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController, GameError, ACTIONS } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player: { id: 1, isAlive: true, isSheriff: true, name: 'P1' } })
    })
    game.handleAction.mockRejectedValueOnce(new GameError('giveup failed', 'E1401'))
    const e = makeEvent()

    expect(ActionController.giveupTransfer(e)).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), ACTIONS.GIVEUP)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('giveup failed')
  })

  test('giveupTransfer replies fallback message for non-GameError', async () => {
    const game = {
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player: { id: 1, isAlive: true, isSheriff: true, name: 'P1' } })
    })
    const e = makeEvent()

    expect(ActionController.giveupTransfer(e)).toBe(true)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('操作失败，发生了未知错误。')
  })

  test('support forwards vote action', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(() => Promise.resolve()),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController, ACTIONS } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player: { id: 1, isAlive: true, isSheriff: false, name: 'P1' } })
    })
    const e = makeEvent()

    expect(ActionController.support(e, 2)).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), ACTIONS.VOTE, 2)
  })

  test('support rejects when target is missing', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => null),
      handleAction: jest.fn(),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController } = await loadActionController({ game })
    const e = makeEvent({ msg: '#支持 2号' })

    expect(ActionController.support(e, 2)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('目标玩家不存在，请指定正确的玩家编号。')
  })

  test('support catches rejection and replies', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController, GameError } = await loadActionController({ game })
    game.handleAction.mockRejectedValueOnce(new GameError('support failed', 'E1400'))
    const e = makeEvent()

    expect(ActionController.support(e, 2)).toBe(true)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('support failed')
  })

  test('support replies fallback message for non-GameError', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.support(e, 2)).toBe(true)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('操作失败，发生了未知错误。')
  })

  test('wolfDiscuss rejects empty content', async () => {
    const game = { handleAction: jest.fn(), stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) } }
    const { ActionController } = await loadActionController({ game })
    const e = makeEvent({ msg: '#讨论   ' })

    expect(ActionController.wolfDiscuss(e)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('讨论内容不能为空')
  })

  test('wolfDiscuss accepts explicit message argument', async () => {
    const game = {
      handleAction: jest.fn(() => Promise.resolve()),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController } = await loadActionController({ game })
    const e = makeEvent({ msg: '#讨论 ignored' })

    expect(ActionController.wolfDiscuss(e, 'hello')).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), 'discuss', 'hello')
  })

  test('wolfDiscuss catches rejection', async () => {
    const game = { handleAction: jest.fn(() => Promise.reject(new Error('x'))), stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) } }
    const { ActionController } = await loadActionController({ game })
    const e = makeEvent({ msg: '#讨论 hello' })

    expect(ActionController.wolfDiscuss(e)).toBe(true)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('操作失败，发生了未知错误。')
  })

  test('wolfDiscuss catches GameError and replies message', async () => {
    const game = { handleAction: jest.fn(() => Promise.reject(new Error('x'))), stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) } }
    const { ActionController, GameError } = await loadActionController({ game })
    game.handleAction.mockRejectedValueOnce(new GameError('discuss failed', 'E1200'))
    const e = makeEvent({ msg: '#讨论 hello' })

    expect(ActionController.wolfDiscuss(e)).toBe(true)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('discuss failed')
  })

  test('roleAction rejects unknown action type', async () => {
    const game = { stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }, handleAction: jest.fn() }
    const { ActionController } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.roleAction(e, 'unknown')).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('未知技能类型')
  })

  test('roleAction forwards action and catches rejection', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController, GameError, ACTIONS } = await loadActionController({ game })
    game.handleAction.mockRejectedValueOnce(new GameError('role failed', 'E1200'))
    const e = makeEvent()

    expect(ActionController.roleAction(e, 'check', 2)).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), ACTIONS.CHECK, 2)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('role failed')
  })

  test('roleAction replies fallback message for non-GameError', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController, ACTIONS } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.roleAction(e, 'check', 2)).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), ACTIONS.CHECK, 2)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('操作失败，发生了未知错误。')
  })

  test('roleAction delegates to shoot when actionType is shoot', async () => {
    const game = { roles: new Map(), stateMachine: { getCurrentState: () => ({}) } }
    const { ActionController } = await loadActionController({ game })
    const spy = jest.spyOn(ActionController, 'shoot').mockResolvedValue(true)
    const e = makeEvent()

    const ok = ActionController.roleAction(e, 'shoot', 2)

    expect(ok).toBeInstanceOf(Promise)
    await ok
    expect(spy).toHaveBeenCalledWith(e, 2)
    spy.mockRestore()
  })

  test('endSpeech rejects when state is missing', async () => {
    const game = { stateMachine: { getCurrentState: () => null }, handleAction: jest.fn() }
    const { ActionController } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.endSpeech(e)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('游戏尚未开始或已结束')
  })

  test('endSpeech forwards END_SPEECH and catches rejection', async () => {
    const game = {
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController, GameError, ACTIONS } = await loadActionController({ game })
    game.handleAction.mockRejectedValueOnce(new GameError('end speech failed', 'E1200'))
    const e = makeEvent()

    expect(ActionController.endSpeech(e)).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), ACTIONS.END_SPEECH)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('end speech failed')
  })

  test('endSpeech replies fallback message for non-GameError', async () => {
    const game = {
      handleAction: jest.fn(() => Promise.reject(new Error('x'))),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController, ACTIONS } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.endSpeech(e)).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), ACTIONS.END_SPEECH)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('操作失败，发生了未知错误。')
  })

  test('_assertActionAllowedOrReply replies reason when current state disallows action', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(() => Promise.resolve()),
      stateMachine: {
        getCurrentState: () => ({
          isValidAction: () => false,
          getInvalidActionReason: () => 'nope'
        })
      }
    }

    const { ActionController } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.vote(e, 2)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('nope')
  })

  test('_assertActionAllowedOrReply uses default message when no reason function', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(() => Promise.resolve()),
      stateMachine: {
        getCurrentState: () => ({
          isValidAction: () => false
        })
      }
    }

    const { ActionController } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.vote(e, 2)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('当前状态不允许此操作')
  })

  test('abstain returns false when current state disallows action', async () => {
    const game = {
      handleAction: jest.fn(),
      stateMachine: {
        getCurrentState: () => ({
          isValidAction: () => false,
          getInvalidActionReason: () => 'no abstain'
        })
      }
    }
    const { ActionController } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.abstain(e)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('no abstain')
  })

  test('endSpeech returns false when current state disallows action', async () => {
    const game = {
      handleAction: jest.fn(),
      stateMachine: {
        getCurrentState: () => ({
          isValidAction: () => false,
          getInvalidActionReason: () => 'no endSpeech'
        })
      }
    }
    const { ActionController } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.endSpeech(e)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('no endSpeech')
  })

  test('roleAction returns false when current state disallows action', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(),
      stateMachine: {
        getCurrentState: () => ({
          isValidAction: () => false,
          getInvalidActionReason: () => 'no role'
        })
      }
    }
    const { ActionController } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.roleAction(e, 'check', 2)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('no role')
  })

  test('_assertAliveOrReply replies when validatePlayer fails', async () => {
    const game = {}
    const { ActionController } = await loadActionController({
      game,
      validatePlayer: () => ({ isValid: false, error: { message: 'dead' } })
    })
    const e = makeEvent()

    expect(ActionController._assertAliveOrReply(e, { id: 1 })).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('dead')
  })

  test('_assertAliveOrReply uses fallback message when error is missing', async () => {
    const game = {}
    const { ActionController } = await loadActionController({
      game,
      validatePlayer: () => ({ isValid: false })
    })
    const e = makeEvent()

    expect(ActionController._assertAliveOrReply(e, { id: 1 })).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('你已死亡，无法操作')
  })

  test('_getPlayerOrReply replies when validateGamePlayer fails', async () => {
    const game = {}
    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: false, error: { message: 'not in game' } })
    })
    const e = makeEvent()

    const res = ActionController._getPlayerOrReply(e, game)

    expect(res).toBe(null)
    expect(e.reply).toHaveBeenCalledWith('not in game')
  })

  test('_getPlayerOrReply uses fallback message when error is missing', async () => {
    const game = {}
    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: false })
    })
    const e = makeEvent()

    const res = ActionController._getPlayerOrReply(e, game)

    expect(res).toBe(null)
    expect(e.reply).toHaveBeenCalledWith('你不在本局游戏中')
  })

  test('_assertStateOrReply replies when validateGameState fails', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController } = await loadActionController({
      game,
      validateGameState: () => ({ isValid: false, error: { message: 'bad stage' } })
    })
    const e = makeEvent()

    expect(ActionController.vote(e, 2)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('bad stage')
  })

  test('_assertStateOrReply uses fallback message when error has no message', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController } = await loadActionController({
      game,
      validateGameState: () => ({ isValid: false, error: null })
    })
    const e = makeEvent()

    expect(ActionController.vote(e, 2)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('当前阶段不能执行此操作')
  })

  test('sheriffTransfer rejects when target is missing', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => null),
      handleAction: jest.fn(),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player: { id: 1, isAlive: true, isSheriff: true, name: 'P1' } })
    })
    const e = makeEvent({ msg: '#移交 2号' })

    expect(ActionController.sheriffTransfer(e, 2)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('目标玩家不存在，请指定正确的玩家编号。')
  })

  test('action allowance check is skipped when current state has no isValidAction', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => ({ id: 2, isAlive: true, name: 'P2' })),
      handleAction: jest.fn(() => Promise.resolve()),
      stateMachine: { getCurrentState: () => ({}) }
    }
    const { ActionController, ACTIONS } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.vote(e, 2)).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), ACTIONS.VOTE, 2)
  })

  test('endSpeech uses DayState.handleEndSpeech when available', async () => {
    const dayState = {
      handleEndSpeech: jest.fn(() => Promise.resolve())
    }

    const game = {
      stateMachine: { getCurrentState: () => dayState }
    }

    const { ActionController, DayState } = await loadActionController({ game })
    Object.setPrototypeOf(dayState, DayState.prototype)

    const e = makeEvent()
    const ok = ActionController.endSpeech(e)

    expect(ok).toBe(true)
    await new Promise(resolve => setImmediate(resolve))
    expect(dayState.handleEndSpeech).toHaveBeenCalled()
  })

  test('endSpeech catches DayState.handleEndSpeech rejection', async () => {
    const dayState = {
      handleEndSpeech: jest.fn(() => Promise.reject(new Error('x')))
    }

    const game = {
      stateMachine: { getCurrentState: () => dayState }
    }

    const { ActionController, DayState } = await loadActionController({ game })
    Object.setPrototypeOf(dayState, DayState.prototype)

    const e = makeEvent()
    const ok = ActionController.endSpeech(e)

    expect(ok).toBe(true)
    await new Promise(resolve => setImmediate(resolve))
    expect(e.reply).toHaveBeenCalledWith('结束发言失败')
  })

  test('roleAction replies when explicit target number is invalid', async () => {
    const game = {
      getPlayerByNumber: jest.fn(() => null),
      handleAction: jest.fn(),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.roleAction(e, 'check', 99)).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('目标玩家不存在，请指定正确的玩家编号。')
  })

  test('roleAction passes null targetId when no target number provided', async () => {
    const game = {
      getPlayerByNumber: jest.fn(),
      handleAction: jest.fn(() => Promise.resolve()),
      stateMachine: { getCurrentState: () => ({ isValidAction: () => true }) }
    }
    const { ActionController, ACTIONS } = await loadActionController({ game })
    const e = makeEvent()

    expect(ActionController.roleAction(e, 'skip')).toBe(true)
    expect(game.handleAction).toHaveBeenCalledWith(expect.any(Object), ACTIONS.SKIP, null)
  })

  test('shoot rejects when not HunterRole', async () => {
    const player = { id: 1, isAlive: true, name: 'P1' }
    const game = { roles: new Map([[1, { constructor: { name: 'VillagerRole' } }]]) }
    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player })
    })
    const e = makeEvent()

    const ok = await ActionController.shoot(e, 2)

    expect(ok).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('只有猎人可以开枪')
  })

  test('shoot replies when no game exists', async () => {
    const { ActionController } = await loadActionController({ game: null })
    const e = makeEvent()

    const ok = await ActionController.shoot(e, 1)

    expect(ok).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('当前群没有进行中的游戏。')
  })

  test('shoot replies when player is not in game', async () => {
    const game = { roles: new Map() }
    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: false, error: { message: 'no player' } })
    })
    const e = makeEvent()

    const ok = await ActionController.shoot(e, 1)

    expect(ok).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('no player')
  })

  test('shoot rejects when HunterRole cannot act', async () => {
    class HunterRole { canAct () { return false } }
    const player = { id: 1, isAlive: true, name: 'Hunter' }
    const game = { roles: new Map([[1, new HunterRole()]]) }
    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player })
    })
    const e = makeEvent()

    const ok = await ActionController.shoot(e, 2)

    expect(ok).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('当前无法开枪')
  })

  test('shoot rejects when target number is missing', async () => {
    class HunterRole { canAct () { return true } }
    const player = { id: 1, isAlive: true, name: 'Hunter' }
    const game = { roles: new Map([[1, new HunterRole()]]) }
    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player })
    })
    const e = makeEvent({ msg: '' })

    const ok = await ActionController.shoot(e, null)

    expect(ok).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('请指定正确的玩家编号。')
  })

  test('shoot rejects when target is missing/dead/self', async () => {
    class HunterRole { canAct () { return true } }
    const player = { id: 1, isAlive: true, name: 'Hunter' }
    const dead = { id: 2, isAlive: false, name: 'Dead' }

    const game = {
      roles: new Map([[1, new HunterRole()]]),
      getPlayerByNumber: jest.fn()
    }
    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player })
    })
    const e = makeEvent()

    game.getPlayerByNumber.mockReturnValueOnce(null)
    expect(await ActionController.shoot(e, 2)).toBe(false)
    expect(e.reply).toHaveBeenLastCalledWith('目标玩家不存在，请指定正确的玩家编号。')

    game.getPlayerByNumber.mockReturnValueOnce(dead)
    expect(await ActionController.shoot(e, 2)).toBe(false)
    expect(e.reply).toHaveBeenLastCalledWith('目标玩家已死亡')

    game.getPlayerByNumber.mockReturnValueOnce(player)
    expect(await ActionController.shoot(e, 1)).toBe(false)
    expect(e.reply).toHaveBeenLastCalledWith('不能对自己开枪')
  })

  test('shoot catches handlePlayerDeath error and replies', async () => {
    class HunterRole {
      constructor () { this.canShoot = true }
      canAct () { return true }
    }

    const player = { id: 1, isAlive: true, name: 'Hunter' }
    const target = { id: 2, isAlive: true, name: 'Target' }
    const game = {
      roles: new Map([[1, new HunterRole()]]),
      getPlayerByNumber: jest.fn(() => target),
      handlePlayerDeath: jest.fn(async () => { throw new Error('boom') })
    }

    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player })
    })
    const e = makeEvent()

    const ok = await ActionController.shoot(e, 2)

    expect(ok).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('开枪失败，发生了未知错误。')
  })

  test('shoot replies GameError message on failure', async () => {
    class HunterRole {
      constructor () { this.canShoot = true }
      canAct () { return true }
    }

    const player = { id: 1, isAlive: true, name: 'Hunter' }
    const target = { id: 2, isAlive: true, name: 'Target' }
    const game = {
      roles: new Map([[1, new HunterRole()]]),
      getPlayerByNumber: jest.fn(() => target),
      handlePlayerDeath: jest.fn(async () => true)
    }

    const { ActionController, GameError } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player })
    })
    game.handlePlayerDeath.mockImplementationOnce(async () => { throw new GameError('gun failed', 'E1504') })
    const e = makeEvent()

    const ok = await ActionController.shoot(e, 2)
    expect(ok).toBe(false)
    expect(e.reply).toHaveBeenCalledWith('gun failed')
  })

  test('shoot success marks canShoot=false and kills target', async () => {
    class HunterRole {
      constructor () {
        this.canShoot = true
      }
      canAct () { return true }
    }

    const player = { id: 1, isAlive: true, name: 'Hunter' }
    const target = { id: 2, isAlive: true, name: 'Target' }

    const game = {
      roles: new Map([[1, new HunterRole()]]),
      getPlayerByNumber: jest.fn(() => target),
      handlePlayerDeath: jest.fn(async () => true)
    }

    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player })
    })
    const e = makeEvent({ msg: '#开枪 2号' })

    const ok = await ActionController.shoot(e, 2)

    expect(ok).toBe(true)
    expect(game.roles.get(1).canShoot).toBe(false)
    expect(game.handlePlayerDeath).toHaveBeenCalledWith(target, 'HUNTER_SHOT')
    expect(e.reply).toHaveBeenCalledWith('猎人 Hunter 开枪射杀了 Target')       
  })

  test('shoot succeeds even when role has no own canShoot property', async () => {
    class HunterRole {
      canAct () { return true }
    }
    // Prototype property (not an "own" property), so hasOwnProperty check is false.
    HunterRole.prototype.canShoot = true

    const player = { id: 1, isAlive: true, name: 'Hunter' }
    const target = { id: 2, isAlive: true, name: 'Target' }
    const game = {
      roles: new Map([[1, new HunterRole()]]),
      getPlayerByNumber: jest.fn(() => target),
      handlePlayerDeath: jest.fn(async () => true)
    }
    const { ActionController } = await loadActionController({
      game,
      validateGamePlayer: () => ({ isValid: true, player })
    })
    const e = makeEvent()

    const ok = await ActionController.shoot(e, 2)

    expect(ok).toBe(true)
    expect(game.handlePlayerDeath).toHaveBeenCalled()
  })
})
