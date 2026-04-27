import { jest } from '@jest/globals'

export function createMockEvent (overrides = {}) {
  const defaults = {
    group_id: 1001,
    user_id: 'u1',
    reply: jest.fn(),
    bot: {
      fl: { has: jest.fn(() => true) },
      pickFriend: jest.fn(() => ({ sendMsg: jest.fn() })),
      pickGroup: jest.fn(() => ({ sendMsg: jest.fn() }))
    },
    isMaster: false,
    msg: '',
    member: { card: '', nickname: '' },
    sender: { nickname: '' }
  }
  const result = { ...defaults, ...overrides }
  if (overrides.bot) result.bot = { ...defaults.bot, ...overrides.bot }
  if (overrides.bot?.fl) result.bot.fl = { ...defaults.bot.fl, ...overrides.bot.fl }
  if (overrides.member) result.member = { ...defaults.member, ...overrides.member }
  if (overrides.sender) result.sender = { ...defaults.sender, ...overrides.sender }
  return result
}

export function createMockPlayer (overrides = {}) {
  const name = overrides.name || '未知玩家'
  return {
    id: 'p1',
    isAlive: true,
    isSheriff: false,
    role: null,
    gameNumber: null,
    protected: false,
    deathReason: null,
    deathTurn: null,
    votedBy: new Set(),
    get name () { return name },
    ...overrides
  }
}

export function createMockState (name, overrides = {}) {
  const StateCtor = { [name]: class {
    constructor () {
      this.onEnter = overrides.onEnter || jest.fn()
      this.onExit = overrides.onExit || jest.fn()
      this.setContext = overrides.setContext || jest.fn()
      this.handleAction = overrides.handleAction || jest.fn()
      this.isValidAction = overrides.isValidAction
      this.canEnd = overrides.canEnd
      this.onTimeout = overrides.onTimeout
      this.e = overrides.e || null
    }

    getName () { return name }
  } }[name]

  return new StateCtor()
}

export function createMockStateMachine (initialState = null) {
  const sm = {
    currentState: initialState,
    _pendingState: null,
    setContext: jest.fn(),
    getCurrentState: jest.fn(() => sm.currentState),
    changeState: jest.fn(async (s) => { sm.currentState = s; return true }),
    setStateTransitionContext: jest.fn()
  }
  return sm
}
