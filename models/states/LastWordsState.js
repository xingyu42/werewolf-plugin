/**
 * @file LastWordsState.js
 * @description 遗言状态类，处理玩家死亡后的遗言和后续流程
 * @module model/strategies/states/LastWordsState
 *
 * @input GameState, HunterRole, SheriffTransferState, NightPhaseController
 * @output LastWordsState - 遗言状态类
 * @pos 策略层 - 遗言阶段，处理猎人开枪和警长移交
 *
 * @dependencies
 * - ./GameState.js - 状态基类
 * - ../roles/HunterRole.js - 猎人角色
 * - ./SheriffTransferState.js - 警长移交状态
 * - ./NightPhaseController.js - 夜晚控制器
 */
import { GameState } from './GameState.js'
import { HunterRole } from '../roles/HunterRole.js'
import { SheriffTransferState } from './SheriffTransferState.js'
import { NightPhaseController } from './NightPhaseController.js'

export class LastWordsState extends GameState {
  constructor (game, nextState, deadPlayer) {
    super(game)
    this.deadPlayer = deadPlayer // 死亡玩家
    this.nextState = nextState // 下一个状态
    this.timeLimit = game.getConfig().game.lastWordsTimeLimit // 遗言时间限制
    this.speechTimeout = null // 发言计时器
    this.hasSpoken = false // 是否已发言
  }

  async onEnter () {
    await super.onEnter()

    // 显示遗言提示
    await this.e.reply(`\n=== ${this.deadPlayer.name}的遗言时间 ===\n` +
      `剩余时间: ${this.timeLimit}秒\n` +
      '输入"#结束遗言"可以放弃遗言', true, { at: true })

    // 设置遗言计时器
    this.speechTimeout = setTimeout(async () => {
      try {
        await this.onTimeout()
      } catch (err) {
        console.error('遗言超时处理失败:', err)
      }
    }, this.timeLimit * 1000)
  }

  async onExit () {
    await super.onExit()

    // 清除计时器
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout)
      this.speechTimeout = null
    }

    // 检查死亡玩家是特殊角色
    const deadRole = this.game.roles.get(this.deadPlayer.id)
    if (deadRole instanceof HunterRole && deadRole.canAct()) {
      await this.game.notificationCenter.sendMessage('group', null, `猎人 ${this.deadPlayer.name} 的遗言结束，现在可以开枪`)
      await deadRole.getActionPrompt()
    }
  }

  getResolvedNextState () {
    const fallbackNextState = this.nextState || new NightPhaseController(this.game)

    if (!this.deadPlayer?.isSheriff) {
      return fallbackNextState
    }

    return new SheriffTransferState(this.game, this.deadPlayer, fallbackNextState)
  }

  async transitionToNextState () {
    const resolvedNextState = this.getResolvedNextState()

    // 状态校验依赖 deadPlayer，上下文必须在调用 changeState 前设置
    this.game.setStateTransitionContext({ deadPlayer: this.deadPlayer })

    if (this.deadPlayer?.isSheriff && resolvedNextState instanceof SheriffTransferState) {
      await this.game.notificationCenter.sendMessage('group', null, `警长 ${this.deadPlayer.name} 死亡，现在可以转移警徽`)
    }

    await this.game.changeState(resolvedNextState)
  }

  // 处理玩家行为
  async handleAction (player, action, message) {
    if (!this.isValidAction(player, action)) {
      const reason = this.getInvalidActionReason(player, action)
      throw new Error(reason)
    }

    if (action === 'skip') {
      await this.handleSkip(player)
    } else {
      throw new Error(`未知操作: ${action}`)
    }
  }

  // 获取非法操作的原因
  getInvalidActionReason (player, action) {
    if (player.id !== this.deadPlayer.id) {
      return '只有死亡玩家可以跳过遗言'
    }
    if (this.hasSpoken) {
      return '已经发表过遗言'
    }
    if (action !== 'skip') {
      return '无效的操作类型'
    }
    return '未知原因'
  }

  // 处理跳过
  async handleSkip (player) {
    try {
      // 清除计时器
      if (this.speechTimeout) {
        clearTimeout(this.speechTimeout)
        this.speechTimeout = null
      }

      this.hasSpoken = true

      await this.e.reply(`${player.name}放弃了遗言`)

      // 进入下一个状态
      await this.transitionToNextState()
    } catch (err) {
      console.error('处理跳过遗言时出错:', err)
      this.hasSpoken = false
      throw err
    }
  }

  // 检查行动是否有效
  isValidAction (player, action) {
    if (player.id !== this.deadPlayer.id) return false
    if (this.hasSpoken) return false

    return action === 'speak' || action === 'skip'
  }

  // 结束遗言
  async onTimeout () {
    try {
      if (!this.hasSpoken) {
        this.hasSpoken = true
        await this.e.reply(`\n=== ${this.deadPlayer.name}的遗言结束 ===\n`)

        // 进入下一个状态
        await this.transitionToNextState()
      }
    } catch (err) {
      console.error('结束遗言出错:', err)
      // 强制进入下一个状态
      const fallbackNextState = this.nextState || new NightPhaseController(this.game)
      await this.game.changeState(fallbackNextState)
    }
  }
}
