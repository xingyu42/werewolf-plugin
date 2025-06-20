import { GameState } from './GameState.js'
import { DayState } from './DayState.js'
import { SimpleStateNotifier } from '../adapters/SimpleStateNotifier.js'
import { SimpleMessageSender } from '../adapters/SimpleMessageSender.js'

export class NightState extends GameState {
  constructor (game) {
    super(game)
    // 角色行动队列与状态控制
    this.actionQueue = ['GuardRole', 'ProphetRole', 'WolfRole', 'WitchRole'] // 角色行动顺序
    this.currentActionRole = null // 当前行动角色
    this.actionLock = false // 状态锁
    this.completedRoles = new Set() // 已完成行动的角色
    this.roleActions = new Map() // 记录各角色行动
    this.wolfVotes = new Map() // 狼人投票记录，用于超时处理
  }

  async onEnter () {
    await super.onEnter()
    this.roleActions.clear()
    this.completedRoles.clear()
    this.wolfVotes.clear() // 清理狼人投票记录

    // 使用SimpleStateNotifier发送夜晚开始通知
    try {
      await SimpleStateNotifier.notifyNightStart(this.game, this.game.e)
      console.log('[NightState] 夜晚开始通知发送成功')
    } catch (error) {
      console.error('[NightState] 发送夜晚开始通知时发生异常:', error)
    }

    // 开始第一个角色的行动
    await this.startNextRoleAction()
  }

  // 开始下一个角色的行动
  async startNextRoleAction () {
    if (this.actionLock) return

    // 所有角色行动完成，进入下一阶段
    if (this.completedRoles.size >= this.actionQueue.length || this.actionQueue.length === 0) {
      return this.finishNightPhase()
    }

    this.actionLock = true
    this.currentActionRole = this.actionQueue.shift()

    // 通知该角色类型的所有活着的玩家
    await this.notifyRolePlayers(this.currentActionRole)
    this.actionLock = false
  }

  // 通知特定角色的玩家行动
  async notifyRolePlayers (roleType) {
    const playerRoles = this.game.getAlivePlayers({ roleType, includeRole: true })
    if (playerRoles.length === 0) {
      // 没有该角色的存活玩家，直接进入下一角色
      this.completedRoles.add(roleType)
      return this.startNextRoleAction()
    }

    // 使用SimpleStateNotifier通知特定角色行动
    try {
      await SimpleStateNotifier.notifyRoleAction(this.game, roleType, this.game.e)
      console.log(`[NightState] 角色 ${roleType} 行动通知发送成功`)
    } catch (error) {
      console.error(`[NightState] 发送角色 ${roleType} 行动通知时发生异常:`, error)
    }
  }

  // 通知玩家夜晚行动
  async notifyPlayer (player, role) {
    if (!role) return
    if (role.constructor.name !== this.currentActionRole) return

    const msg = role.getActionPrompt()
    try {
      await SimpleMessageSender.sendPrivate(msg, player.id, this.game.e)
    } catch (error) {
      console.error(`向玩家 ${player.id} 发送夜晚行动消息异常:`, error)
    }
  }

  // 处理玩家行动
  async handleAction (player, action, target) {
    if (this.actionLock) return false

    const role = this.game.playerManager.roles.get(player.id)

    if (!this.isValidAction(player, action, role)) {
      throw new Error('非法操作')
    }

    const roleType = role.constructor.name

    if (roleType !== this.currentActionRole) {
      throw new Error(`现在是${this.currentActionRole}的行动时间，请等待你的回合`)
    }

    // 记录行动
    this.roleActions.set(player.id, {
      player,
      roleType,
      action,
      target,
      completed: true
    })

    // 执行角色行动
    const result = await role.act(this.game.playerManager.getPlayerById(target), action)

    // 如果行动完成,检查是否需要进入下一阶段
    if (result) {
      const rolePlayers = this.game.getAlivePlayers({ roleType, includeRole: true })
      const actedPlayers = [...this.roleActions.keys()]
        .filter(id => {
          const action = this.roleActions.get(id)
          return action && action.roleType === roleType
        })

      if (actedPlayers.length >= rolePlayers.length) {
        this.completedRoles.add(roleType)
        await this.startNextRoleAction()
      }
    }
  }

  // 夜晚阶段结束，处理状态转换
  async finishNightPhase () {
    // 清理保护状态
    for (const player of this.game.playerManager.getAllPlayers().values()) {
      player.protected = false
    }

    // 状态转换
    if (this.game.turn === 0) {
      await this.game.changeState(new DayState(this.game))
    }
  }

  // 超时处理
  async onTimeout () {
    // 处理当前行动角色
    if (this.currentActionRole) {
      // 获取未行动的玩家
      const rolePlayers = this.game.getAlivePlayers({ roleType: this.currentActionRole, includeRole: true })
      const actedPlayerIds = new Set(
        [...this.roleActions.values()]
          .filter(a => a.roleType === this.currentActionRole)
          .map(a => a.player.id)
      )

      // 为未行动玩家设置默认行动
      for (const { player } of rolePlayers) {
        if (!actedPlayerIds.has(player.id)) {
          // 根据角色类型设置默认行动
          if (this.currentActionRole === 'WolfRole' && !this.wolfVotes.has(player.id)) {
            // 狼人默认弃权
            this.wolfVotes.set(player.id, {
              wolfId: player.id,
              targetId: null,
              timestamp: Date.now()
            })
          } else {
            // 其他角色默认为跳过
            this.roleActions.set(player.id, {
              player,
              roleType: this.currentActionRole,
              action: 'skip',
              completed: true
            })
          }
        }
      }

      // 标记当前角色行动完成
      this.completedRoles.add(this.currentActionRole)
    }

    // 将剩余所有角色标记为已完成
    this.actionQueue.forEach(roleType => {
      this.completedRoles.add(roleType)
    })

    // 结束夜晚阶段
    await this.finishNightPhase()
  }
}
