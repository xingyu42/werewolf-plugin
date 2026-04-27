import { describe, expect, test } from '@jest/globals'
import {
  ACTIONS,
  BALANCE_THRESHOLDS,
  CAMPS,
  CONFIG_KEYS,
  DEATH_REASONS,
  GAME_PHASES,
  MESSAGE_TYPES,
  NIGHT_PHASE_CONFIG,
  NIGHT_PHASE_ORDER,
  NIGHT_PHASE_STATES,
  PLAYER_STATES,
  ROLES,
  ROLE_CAMPS,
  ROLE_NAMES_CN,
  ROLE_WEIGHTS,
  toRoleClassName
} from '../../models/Constants.js'

describe('Constants', () => {
  describe('toRoleClassName', () => {
    test('should convert uppercase role constants to PascalCase role class names', () => {
      expect(toRoleClassName('PROPHET')).toBe('ProphetRole')
      expect(toRoleClassName('WOLF')).toBe('WolfRole')
      expect(toRoleClassName('VILLAGER')).toBe('VillagerRole')
    })

    test('should return empty string when role constant is nullish or non-string', () => {
      expect(toRoleClassName(null)).toBe('')
      expect(toRoleClassName(undefined)).toBe('')
      expect(toRoleClassName(123)).toBe('')
      expect(toRoleClassName({ role: 'WOLF' })).toBe('')
    })
  })

  describe('role and camp constants', () => {
    test('should expose all supported role constants', () => {
      expect(ROLES).toEqual({
        WOLF: 'WOLF',
        PROPHET: 'PROPHET',
        WITCH: 'WITCH',
        HUNTER: 'HUNTER',
        GUARD: 'GUARD',
        VILLAGER: 'VILLAGER'
      })
    })

    test('should map roles to camps and Chinese names', () => {
      expect(CAMPS).toEqual({
        WOLF: 'WOLF',
        GOD: 'GOD',
        VILLAGER: 'VILLAGER'
      })

      expect(ROLE_CAMPS[ROLES.WOLF]).toBe(CAMPS.WOLF)
      expect(ROLE_CAMPS[ROLES.VILLAGER]).toBe(CAMPS.VILLAGER)
      expect(ROLE_CAMPS[ROLES.PROPHET]).toBe(CAMPS.GOD)
      expect(ROLE_CAMPS[ROLES.WITCH]).toBe(CAMPS.GOD)
      expect(ROLE_CAMPS[ROLES.HUNTER]).toBe(CAMPS.GOD)
      expect(ROLE_CAMPS[ROLES.GUARD]).toBe(CAMPS.GOD)

      expect(ROLE_NAMES_CN).toMatchObject({
        [ROLES.WOLF]: '狼人',
        [ROLES.PROPHET]: '预言家',
        [ROLES.WITCH]: '女巫',
        [ROLES.HUNTER]: '猎人',
        [ROLES.GUARD]: '守卫',
        [ROLES.VILLAGER]: '村民'
      })
    })

    test('should define role weights for balance calculation', () => {
      expect(ROLE_WEIGHTS[ROLES.WOLF]).toBeLessThan(0)
      expect(ROLE_WEIGHTS[ROLES.VILLAGER]).toBeGreaterThan(0)
      expect(ROLE_WEIGHTS[ROLES.PROPHET]).toBeGreaterThan(ROLE_WEIGHTS[ROLES.VILLAGER])
      expect(Object.keys(ROLE_WEIGHTS).sort()).toEqual(Object.values(ROLES).sort())
    })
  })

  describe('game constants', () => {
    test('should expose action, phase, player state, death reason, config and message constants', () => {
      expect(ACTIONS).toMatchObject({
        VOTE: 'vote',
        ABSTAIN: 'abstain',
        SKIP: 'skip',
        REGISTER: 'register',
        TRANSFER: 'transfer',
        GIVEUP: 'giveup',
        SUPPORT: 'support',
        END_SPEECH: 'endSpeech',
        PROTECT: 'protect',
        CHECK: 'check',
        POISON: 'poison',
        SAVE: 'save',
        KILL: 'kill',
        SUICIDE: 'suicide'
      })

      expect(GAME_PHASES).toMatchObject({
        WAITING: 'waiting',
        STARTING: 'starting',
        SHERIFF_ELECTION: 'sheriff_election',
        DAY_DISCUSSION: 'day_discussion',
        DAY_VOTING: 'day_voting',
        NIGHT: 'night',
        GAME_END: 'game_end'
      })

      expect(PLAYER_STATES).toEqual({
        ALIVE: 'alive',
        DEAD: 'dead',
        SPECTATOR: 'spectator'
      })

      expect(DEATH_REASONS).toMatchObject({
        WOLF_KILL: 'WOLF_KILL',
        EXILE: 'EXILE',
        POISON: 'POISON',
        HUNTER_SHOT: 'HUNTER_SHOT'
      })

      expect(CONFIG_KEYS.MIN_PLAYERS).toBe('minPlayers')
      expect(CONFIG_KEYS.ENABLE_TUBIAN).toBe('enableTubian')
      expect(MESSAGE_TYPES).toEqual({
        GROUP: 'group',
        PRIVATE: 'private'
      })
    })

    test('should define balance thresholds as numeric bounds', () => {
      expect(BALANCE_THRESHOLDS.EVIL_RATIO_MIN).toBeLessThan(BALANCE_THRESHOLDS.EVIL_RATIO_MAX)
      expect(BALANCE_THRESHOLDS.WOLF_RATIO_MIN).toBeLessThan(BALANCE_THRESHOLDS.WOLF_RATIO_MAX)
    })
  })

  describe('night phase constants', () => {
    test('should define the three night phase configurations in execution order', () => {
      expect(NIGHT_PHASE_CONFIG.INFORMATION).toMatchObject({
        name: 'information',
        order: 1,
        roles: [ROLES.PROPHET, ROLES.GUARD],
        allowParallel: true
      })

      expect(NIGHT_PHASE_CONFIG.ELIMINATION).toMatchObject({
        name: 'elimination',
        order: 2,
        roles: [ROLES.WOLF],
        allowParallel: false
      })

      expect(NIGHT_PHASE_CONFIG.INTERVENTION).toMatchObject({
        name: 'intervention',
        order: 3,
        roles: [ROLES.WITCH],
        allowParallel: false
      })

      expect(NIGHT_PHASE_ORDER).toEqual([
        NIGHT_PHASE_CONFIG.INFORMATION,
        NIGHT_PHASE_CONFIG.ELIMINATION,
        NIGHT_PHASE_CONFIG.INTERVENTION
      ])
    })

    test('should define required actions and state identifiers for night phases', () => {
      expect(NIGHT_PHASE_CONFIG.INFORMATION.requiredActions[ROLES.PROPHET]).toContain(ACTIONS.CHECK)
      expect(NIGHT_PHASE_CONFIG.INFORMATION.requiredActions[ROLES.GUARD]).toContain(ACTIONS.PROTECT)
      expect(NIGHT_PHASE_CONFIG.ELIMINATION.requiredActions[ROLES.WOLF]).toContain(ACTIONS.KILL)
      expect(NIGHT_PHASE_CONFIG.INTERVENTION.requiredActions[ROLES.WITCH]).toEqual([
        ACTIONS.POISON,
        ACTIONS.SAVE,
        ACTIONS.SKIP
      ])

      expect(NIGHT_PHASE_STATES).toEqual({
        INFORMATION_PHASE: 'InformationPhaseState',
        ELIMINATION_PHASE: 'EliminationPhaseState',
        INTERVENTION_PHASE: 'InterventionPhaseState'
      })
    })
  })
})
