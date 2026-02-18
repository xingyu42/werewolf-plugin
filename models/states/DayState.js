/**
 * @file DayState.js
 * @description 白天状态类，处理白天讨论和状态转换
 * @module model/strategies/states/DayState
 *
 * @input GameState, VoteState, LastWordsState, HunterRole, SheriffElectState, SheriffTransferState
 * @output DayState - 白天状态类
 * @pos 策略层 - 白天讨论阶段
 *
 * @dependencies
 * - ./GameState.js - 状态基类
 * - ./VoteState.js - 投票状态
 * - ./LastWordsState.js - 遗言状态
 * - ../roles/HunterRole.js - 猎人角色
 * - ./SheriffElectState.js - 警长竞选状态
 * - ./SheriffTransferState.js - 警长移交状态
 */
import { GameState } from './GameState.js'
import { VoteState } from './VoteState.js'
import { LastWordsState } from './LastWordsState.js'
import { HunterRole } from '../roles/HunterRole.js'
import { SheriffElectState } from './SheriffElectState.js'
import { SheriffTransferState } from './SheriffTransferState.js'

export class DayState extends GameState {
  constructor (game) {
    super(game)
    this.speakTimeLimit = game.getConfig().game.speakTimeLimit // 发言时间限制
    this.currentSpeakerIndex = 0
    this.speakOrder = []
    this._advancingLock = false // 发言切换互斥锁，防止超时+手动结束并发
    this._hunterShootTimeout = null // 猎人开枪超时定时器
  }

  async onEnter () {
    await super.onEnter()
    const transitioned = await this.announceDeaths()
    if (transitioned) return

    if (this.game._dayStartPending) {
      await this.game.startNewDay()
      this.game._dayStartPending = false
      this.game._dayStartDeathsAnnounced = false
    }
    await this.initializeSpeakOrder()
    await this.startDiscussion()
  }

  // 通知死亡信息
  async announceDeaths () {
    if (!this.game._dayStartPending) return false

    // 获取本夜死亡的玩家（按 deathTurn 过滤，避免累计历史死亡）
    const currentTurn = this.game.turn
    const deadPlayers = [...this.game.players.values()]
      .filter(p => !p.isAlive &&
        (p.deathReason === 'WOLF_KILL' || p.deathReason === 'POISON') &&
        p.deathTurn === currentTurn)

    if (!this.game._dayStartDeathsAnnounced) {
      if (deadPlayers.length === 0) {
        // 替换emit调用为notificationCenter
        await this.game.notificationCenter.sendMessage('group', null, '昨晚是平安夜，没有玩家死亡')
      } else {
        // 构建死亡信息
        let deathMsg = '昨晚死亡的玩家:\n'
        for (const player of deadPlayers) {
          deathMsg += `${player.name}\n`
        }

        await this.game.notificationCenter.sendMessage('group', null, deathMsg)
      }

      this.game._dayStartDeathsAnnounced = true
    }

    // 处理头夜死亡玩家的遗言
    if (this.game.turn === 0 && !this.game._firstNightLastWordsHandled && deadPlayers.length > 0) {
      this.game._firstNightLastWordsHandled = true
      // 设置状态转换上下文
      this.game.setStateTransitionContext({ deadPlayer: deadPlayers[0] })
      await this.game.changeState(new LastWordsState(this.game, this, deadPlayers[0]))
      return true
    }

    // 首夜过后检查死亡玩家中特殊角色
    if (this.game.turn !== 0) {
      // 先收集所有特殊事件，再统一决策
      let hunterToPrompt = null
      let sheriffDead = null

      for (const player of deadPlayers) {
        const role = this.game.roles.get(player.id)

        if (role instanceof HunterRole && role.canAct() && !hunterToPrompt) {
          hunterToPrompt = { player, role }
        }

        if (player.isSheriff && !sheriffDead) {
          sheriffDead = player
        }
      }

      // 处理猎人开枪（含超时保护，防止猎人不操作时卡死）
      if (hunterToPrompt) {
        this.game.setStateTransitionContext({ deadPlayer: hunterToPrompt.player })
        await this.game.notificationCenter.sendMessage('group', null, `猎人 ${hunterToPrompt.player.name} 死亡，现在可以开枪（30秒内操作）`)
        await hunterToPrompt.role.getActionPrompt()

        // 设置猎人开枪超时，超时后自动继续白天流程
        this._hunterShootTimeout = setTimeout(async () => {
          try {
            // 仅当当前状态仍是本 DayState 实例时才恢复流程
            if (this.game.getCurrentState() === this) {
              await this.e.reply(`猎人 ${hunterToPrompt.player.name} 超时未开枪，放弃开枪机会`)
              await this._resumeDayFlow()
            }
          } catch (err) {
            console.error('[DayState] 猎人超时恢复失败:', err)
          }
        }, 30 * 1000)
      }

      // 处理警长死亡（需要状态切换）
      if (sheriffDead) {
        this.game.setStateTransitionContext({ deadPlayer: sheriffDead })
        await this.game.notificationCenter.sendMessage('group', null, `警长 ${sheriffDead.name} 死亡，现在可以转移警徽`)
        await this.game.changeState(new SheriffTransferState(this.game, sheriffDead, this))
        return true
      }

      if (hunterToPrompt) {
        return true
      }
    }

    // 如果是第一个夜晚，进入警长竞选阶段
    if (this.game.turn === 0 && this.game.getConfig().game.sheriff && !this.game._firstDaySheriffElectionHandled) {
      this.game._firstDaySheriffElectionHandled = true
      // 清空状态转换上下文
      this.game.setStateTransitionContext({})
      await this.game.changeState(new SheriffElectState(this.game))
      return true
    }

    return false
  }

  // 初始化发言顺序
  async initializeSpeakOrder () {
    // 获取所有存活玩家
    const alivePlayers = this.game.getAlivePlayers()

    // 如果有警长，从警长开始
    if (this.game.sheriff) {
      const sheriffIndex = alivePlayers.findIndex(p => p.id === this.game.sheriff.id)
      if (sheriffIndex !== -1) {
        // 重排序数组，使警长在第一位
        this.speakOrder = [
          ...alivePlayers.slice(sheriffIndex),
          ...alivePlayers.slice(0, sheriffIndex)
        ]
      }
    } else {
      // 没有警长就按游戏号码顺序
      this.speakOrder = [...alivePlayers].sort((a, b) => a.gameNumber - b.gameNumber)
    }
  }

  // 开始讨论
  async startDiscussion () {
    await this.e.reply('白天阶段开始，按顺序发言')
    await this.nextSpeaker()
  }

  // 处理下一个发言者
  async nextSpeaker () {
    if (this.currentSpeakerIndex >= this.speakOrder.length) {
      // 所有人都发言完毕
      await this.e.reply('所有玩家已完成发言')
      await this.onTimeout()
      return
    }

    const currentPlayer = this.speakOrder[this.currentSpeakerIndex]
    const nextPlayer = this.speakOrder[this.currentSpeakerIndex + 1]

    // 通知当前发言者
    await this.e.reply([
      segment.at(currentPlayer.id),
      `轮到你发言了，请在${this.speakTimeLimit}秒内完成发言\n发言完毕请输入 #结束发言\n`,
      nextPlayer ? `\n下一位发言者: ${nextPlayer.name}` : '\n你是最后一位发言者'
    ])

    // 设置发言超时
    this.speakTimeout = setTimeout(() => {
      this.handleSpeakTimeout(currentPlayer)
    }, this.speakTimeLimit * 1000)
  }

  // 处理发言超时
  async handleSpeakTimeout (player) {
    // 互斥锁：防止与 handleEndSpeech 并发
    if (this._advancingLock) return
    this._advancingLock = true

    await this.e.reply([
      segment.at(player.id),
      '发言时间已到，将自动进入下一位发言'
    ])
    this.currentSpeakerIndex++
    await this.nextSpeaker()
    this._advancingLock = false
  }

  // 处理结束发言
  async handleEndSpeech (player) {
    // 清除发言计时器
    if (this.speakTimeout) {
      clearTimeout(this.speakTimeout)
      this.speakTimeout = null
    }

    // 互斥锁：防止与 handleSpeakTimeout 并发
    if (this._advancingLock) return false

    // 检查是否当前发言者
    if (this.currentSpeakerIndex < this.speakOrder.length &&
        this.speakOrder[this.currentSpeakerIndex].id === player.id) {
      this._advancingLock = true
      await this.e.reply(`${player.name} 结束发言`)

      // 进入下一位发言者
      this.currentSpeakerIndex++
      await this.nextSpeaker()
      this._advancingLock = false
      return true
    } else {
      await this.e.reply(`${player.name} 现在不是你的发言时间`)
      return false
    }
  }

  async onTimeout () {
    await this.e.reply('发言时间结束，进入投票阶段')
    await this.game.changeState(new VoteState(this.game))
  }

  async onExit () {
    await super.onExit()
    // 清理所有定时器
    if (this.speakTimeout) {
      clearTimeout(this.speakTimeout)
      this.speakTimeout = null
    }
    if (this._hunterShootTimeout) {
      clearTimeout(this._hunterShootTimeout)
      this._hunterShootTimeout = null
    }
  }

  /**
   * 恢复白天讨论流程（猎人超时或开枪后调用）
   */
  async _resumeDayFlow () {
    if (this._hunterShootTimeout) {
      clearTimeout(this._hunterShootTimeout)
      this._hunterShootTimeout = null
    }
    if (this.game._dayStartPending) {
      await this.game.startNewDay()
      this.game._dayStartPending = false
      this.game._dayStartDeathsAnnounced = false
    }
    await this.initializeSpeakOrder()
    await this.startDiscussion()
  }
}
