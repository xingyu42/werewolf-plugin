import { describe, expect, test } from '@jest/globals'
import { Player } from '../../models/Player.js'

describe('Player', () => {
  test('should initialize all provided fields and default runtime fields', () => {
    const player = new Player({
      id: 'user-1',
      card: 'Card Name',
      nickname: 'Nick Name',
      senderNickname: 'Sender Name',
      role: 'WOLF',
      isCreator: true,
      isAlive: false,
      isSheriff: true,
      gameNumber: 7
    })

    expect(player.id).toBe('user-1')
    expect(player.name).toBe('Card Name')
    expect(player.role).toBe('WOLF')
    expect(player.isCreator).toBe(true)
    expect(player.isAlive).toBe(false)
    expect(player.isSheriff).toBe(true)
    expect(player.votedBy).toBeInstanceOf(Set)
    expect(player.protected).toBe(false)
    expect(player.gameNumber).toBe(7)
    expect(player.deathReason).toBeNull()
    expect(player.deathTurn).toBeNull()
  })

  test('should initialize optional fields with documented defaults', () => {
    const player = new Player({ id: 'user-1' })

    expect(player.id).toBe('user-1')
    expect(player.name).toBe('未知玩家')
    expect(player.role).toBeNull()
    expect(player.isCreator).toBe(false)
    expect(player.isAlive).toBe(true)
    expect(player.isSheriff).toBe(false)
    expect(player.gameNumber).toBeNull()
    expect(player.votedBy.size).toBe(0)
    expect(player.protected).toBe(false)
  })

  test('should resolve display name by card, nickname, sender nickname and fallback priority', () => {
    expect(new Player({
      id: 'user-1',
      card: 'Card',
      nickname: 'Nick',
      senderNickname: 'Sender'
    }).name).toBe('Card')

    expect(new Player({
      id: 'user-2',
      card: '',
      nickname: 'Nick',
      senderNickname: 'Sender'
    }).name).toBe('Nick')

    expect(new Player({
      id: 'user-3',
      card: '',
      nickname: '',
      senderNickname: 'Sender'
    }).name).toBe('Sender')

    expect(new Player({
      id: 'user-4',
      card: '',
      nickname: '',
      senderNickname: ''
    }).name).toBe('未知玩家')
  })

  test('should get and set role through accessor', () => {
    const player = new Player({ id: 'user-1', role: 'VILLAGER' })

    expect(player.role).toBe('VILLAGER')

    player.role = 'PROPHET'

    expect(player.role).toBe('PROPHET')
  })

  test('should create player from event object', () => {
    const event = {
      user_id: 'user-1',
      member: {
        card: 'Group Card',
        nickname: 'Group Nick'
      },
      sender: {
        nickname: 'Sender Nick'
      }
    }

    const player = Player.fromEvent(event)

    expect(player).toBeInstanceOf(Player)
    expect(player.id).toBe('user-1')
    expect(player.name).toBe('Group Card')
    expect(player.role).toBeNull()
  })

  test('should support missing nested event fields and apply option overrides', () => {
    const event = {
      user_id: 'user-1'
    }

    const player = Player.fromEvent(event, {
      id: 'override-id',
      role: 'HUNTER',
      isCreator: true,
      isAlive: false,
      gameNumber: 3
    })

    expect(player.id).toBe('override-id')
    expect(player.name).toBe('未知玩家')
    expect(player.role).toBe('HUNTER')
    expect(player.isCreator).toBe(true)
    expect(player.isAlive).toBe(false)
    expect(player.gameNumber).toBe(3)
  })
})
