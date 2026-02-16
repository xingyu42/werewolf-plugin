import { Player } from '../../models/Player.js'

describe('Player', () => {
  test('constructor assigns fields and defaults', () => {
    const player = new Player({ id: 123 })

    expect(player.id).toBe(123)
    expect(player.isCreator).toBe(false)
    expect(player.isAlive).toBe(true)
    expect(player.isSheriff).toBe(false)
    expect(player.gameNumber).toBe(null)
    expect(player.deathReason).toBe(null)
    expect(player.votedBy).toBeInstanceOf(Set)
    expect(player.protected).toBe(false)
  })

  test('name priority: card > nickname > senderNickname > fallback', () => {
    expect(new Player({ id: 1, card: 'Card', nickname: 'Nick', senderNickname: 'Sender' }).name).toBe('Card')
    expect(new Player({ id: 1, card: '', nickname: 'Nick', senderNickname: 'Sender' }).name).toBe('Nick')
    expect(new Player({ id: 1, nickname: '', senderNickname: 'Sender' }).name).toBe('Sender')
    expect(new Player({ id: 1 }).name).toBe('未知玩家')
  })

  test('role getter/setter works', () => {
    const player = new Player({ id: 1 })
    expect(player.role).toBe(null)

    player.role = 'WOLF'
    expect(player.role).toBe('WOLF')
  })

  test('fromEvent extracts fields and merges options', () => {
    const e = {
      user_id: 1001,
      member: { card: 'C', nickname: 'N' },
      sender: { nickname: 'S' }
    }

    const player = Player.fromEvent(e, { isCreator: true, isAlive: false })
    expect(player.id).toBe(1001)
    expect(player.name).toBe('C')
    expect(player.isCreator).toBe(true)
    expect(player.isAlive).toBe(false)
  })
})

