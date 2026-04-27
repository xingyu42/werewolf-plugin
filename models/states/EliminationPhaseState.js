/**
 * @file EliminationPhaseState.js
 * @description 消除阶段状态类，处理狼人讨论和击杀
 * @module model/strategies/states/EliminationPhaseState
 *
 * @input NightPhaseState, GameError, NIGHT_PHASE_CONFIG, ACTIONS
 * @output EliminationPhaseState - 消除阶段类
 * @pos 策略层 - 夜晚第二阶段，狼人协作击杀
 *
 * @dependencies
 * - ./NightPhaseState.js - 夜晚阶段基类
 * - ../../core/GameError.js - 游戏错误
 * - ../../core/Constants.js - 阶段配置和行动常量
 */
import { NightPhaseState } from './NightPhaseState.js'
import { GameError } from '../../utils/GameError.js'
import { NIGHT_PHASE_CONFIG, ACTIONS } from '../Constants.js'

export class EliminationPhaseState extends NightPhaseState {
  constructor (game) {
    // 使用消除阶段的配置
    super(game, NIGHT_PHASE_CONFIG.ELIMINATION)

    // 消除阶段特有属性
    this.wolfVotes = new Map() // 狼人投票记录 wolfId -> {targetId, timestamp}
    this.discussionMessages = [] // 狼人讨论记录
    this.finalKillTarget = null // 最终击杀目标
    this.isVotingPhase = false // 是否进入投票阶段
    this.discussionStartTime = null // 讨论开始时间
    this.votingStartTime = null // 投票开始时间
    this.discussionTimeout = null // 讨论阶段超时定时器
    this.votingTimeout = null // 投票阶段超时定时器

    // 阶段时间配置
    this.discussionTime = this.phaseConfig.discussionTime || 60000 // 讨论时间
    this.votingTime = this.phaseConfig.votingTime || 60000 // 投票时间
  }

  /**
   * 启动阶段逻辑 - 开始狼人讨论阶段
   */
  async startPhaseLogic () {
    try {
      console.log('[EliminationPhaseState] 启动消除阶段逻辑')

      // 检查是否有存活的狼人
      const aliveWolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })
      if (aliveWolves.length === 0) {
        console.log('[EliminationPhaseState] 没有存活的狼人，跳过消除阶段')
        await this.completePhase()
        return
      }

      // 开始讨论阶段
      await this.startDiscussionPhase()
    } catch (error) {
      console.error('[EliminationPhaseState] 启动阶段逻辑失败:', error.message || error)
      throw error
    }
  }

  /**
   * 开始讨论阶段
   */
  async startDiscussionPhase () {
    try {
      this.discussionStartTime = Date.now()
      this.isVotingPhase = false

      console.log('[EliminationPhaseState] 开始狼人讨论阶段')

      // 通知所有狼人开始讨论
      await this.notifyWolvesDiscussion()

      // 设置讨论阶段超时
      this.discussionTimeout = setTimeout(async () => {
        if (!this.isVotingPhase && !this.isPhaseCompleted) {
          await this.startVotingPhase()
        }
      }, this.discussionTime)
    } catch (error) {
      console.error('[EliminationPhaseState] 开始讨论阶段失败:', error.message || error)
      throw error
    }
  }

  /**
   * 开始投票阶段
   */
  async startVotingPhase () {
    try {
      this.votingStartTime = Date.now()
      this.isVotingPhase = true

      console.log('[EliminationPhaseState] 开始狼人投票阶段')

      // 通知所有狼人开始投票
      await this.notifyWolvesVoting()

      // 设置投票阶段超时
      this.votingTimeout = setTimeout(async () => {
        if (!this.isPhaseCompleted) {
          await this.handleVotingTimeout()
        }
      }, this.votingTime)
    } catch (error) {
      console.error('[EliminationPhaseState] 开始投票阶段失败:', error.message || error)
      throw error
    }
  }

  /**
   * 通知狼人开始讨论
   */
  async notifyWolvesDiscussion () {
    try {
      const aliveWolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })

      for (const { player, role } of aliveWolves) {
        const discussionPrompt = this.getDiscussionPrompt(player, aliveWolves)
        await role.sendPrivate(discussionPrompt)
      }

      console.log(`[EliminationPhaseState] 已通知 ${aliveWolves.length} 个狼人开始讨论`)
    } catch (error) {
      console.error('[EliminationPhaseState] 通知狼人讨论失败:', error.message || error)
    }
  }

  /**
   * 通知狼人开始投票
   */
  async notifyWolvesVoting () {
    try {
      const aliveWolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })

      for (const { player, role } of aliveWolves) {
        const votingPrompt = this.getVotingPrompt(player, aliveWolves)
        await role.sendPrivate(votingPrompt)
      }

      console.log(`[EliminationPhaseState] 已通知 ${aliveWolves.length} 个狼人开始投票`)
    } catch (error) {
      console.error('[EliminationPhaseState] 通知狼人投票失败:', error.message || error)
    }
  }

  /**
   * 获取讨论阶段提示消息
   */
  getDiscussionPrompt (player, aliveWolves) {
    const otherWolves = aliveWolves.filter(w => w.player.id !== player.id)
    let prompt = '🌙【狼人讨论阶段】\n'
    prompt += `讨论时间：${Math.floor(this.discussionTime / 1000)}秒\n\n`

    if (otherWolves.length > 0) {
      prompt += '其他存活狼人：\n'
      prompt += otherWolves.map(w => `${w.player.gameNumber}号 ${w.player.name}`).join('\n')
      prompt += '\n\n'
    }

    prompt += '可用指令：\n'
    prompt += '#讨论 [内容] - 与其他狼人讨论\n'
    prompt += '#准备投票 - 提前进入投票阶段\n\n'
    prompt += '请与队友讨论今晚的击杀目标...'

    return prompt
  }

  /**
   * 获取投票阶段提示消息
   */
  getVotingPrompt (player, aliveWolves) {
    const alivePlayers = this.game.getAlivePlayers()
    const validTargets = alivePlayers.filter(p => {
      const role = this.game.getPlayerRole(p.id)
      return role && role.getCamp() !== 'WOLF'
    })

    let prompt = '🗳️【狼人投票阶段】\n'
    prompt += `投票时间：${Math.floor(this.votingTime / 1000)}秒\n\n`
    prompt += '可击杀目标：\n'
    prompt += validTargets.map(p => `${p.gameNumber}号 ${p.name}`).join('\n')
    prompt += '\n\n可用指令：\n'
    prompt += '#刀[号码] - 投票击杀指定玩家\n'
    prompt += '#空刀 - 投票放弃击杀\n\n'

    // 显示当前投票情况
    if (this.wolfVotes.size > 0) {
      prompt += '当前投票情况：\n'
      const voteCounts = this.getVoteCounts()
      for (const [targetId, count] of voteCounts.entries()) {
        if (targetId === null) {
          prompt += `空刀: ${count}票\n`
        } else {
          const target = this.game.playerManager.getPlayerById(targetId)
          if (target) {
            prompt += `${target.gameNumber}号 ${target.name}: ${count}票\n`
          }
        }
      }
      prompt += '\n'
    }

    return prompt
  }

  /**
   * 覆写父类 handleAction：discuss / ready_vote 是非终结行动，
   * 不应记入 completedActions，否则会让父类的 checkPhaseCompletion
   * 误判阶段完成，从而绕过 processVoteResult，狼刀失效。
   */
  async handleAction (player, action, data) {
    if (!this.isValidAction(player, action)) {
      throw new GameError('无效的行动', 'INVALID_ACTION', {
        playerId: player.id,
        action,
        phase: this.phaseConfig.name
      })
    }

    const isNonTerminal = action === 'discuss' || action === 'ready_vote'

    if (!isNonTerminal && this.completedActions.has(player.id)) {
      throw new GameError('玩家已完成行动', 'ACTION_ALREADY_COMPLETED', {
        playerId: player.id,
        phase: this.phaseConfig.name
      })
    }

    const result = await this.executePlayerAction(player, action, data)

    if (!isNonTerminal) {
      this.completedActions.set(player.id, {
        player,
        action,
        data,
        result,
        timestamp: Date.now()
      })
      await this.checkPhaseCompletion()
    }

    return result
  }

  /**
   * 执行具体的玩家行动逻辑
   */
  async executePlayerAction (player, action, data) {
    try {
      const role = this.game.playerManager.roles.get(player.id)
      if (!role) {
        throw new GameError('玩家角色不存在', 'ROLE_NOT_FOUND', { playerId: player.id })
      }

      console.log(`[EliminationPhaseState] 执行狼人 ${player.id} 的 ${action} 行动`)

      let result = null

      switch (action) {
        case ACTIONS.KILL:
          result = await this.handleWolfKill(player, role, data)
          break
        case ACTIONS.SKIP:
          result = await this.handleWolfSkip(player, role)
          break
        case ACTIONS.SUICIDE:
          result = await this.handleWolfSuicide(player, role)
          break
        case 'discuss':
          result = await this.handleWolfDiscuss(player, role, data)
          break
        case 'ready_vote':
          result = await this.handleReadyVote(player, role)
          break
        default:
          throw new GameError(`不支持的行动类型: ${action}`, 'UNSUPPORTED_ACTION', { action })
      }

      return result
    } catch (error) {
      if (!(error instanceof GameError)) console.error('[EliminationPhaseState] 执行玩家行动失败:', error.message || error)
      throw error
    }
  }

  /**
   * 处理狼人击杀投票
   */
  async handleWolfKill (player, role, targetId) {
    try {
      if (!this.isVotingPhase) {
        throw new GameError('当前不是投票阶段', 'NOT_VOTING_PHASE')
      }

      // 验证目标
      let target = null
      if (targetId) {
        target = this.game.playerManager.getPlayerById(targetId)
        if (!target) {
          throw new GameError('击杀目标不存在', 'TARGET_NOT_FOUND', { targetId })
        }

        // 验证目标是否可以击杀
        if (!role.isValidTarget(target)) {
          throw new GameError('无效的击杀目标', 'INVALID_TARGET', { targetId })
        }
      }

      // 记录投票
      this.wolfVotes.set(player.id, {
        wolfId: player.id,
        targetId: targetId || null,
        timestamp: Date.now()
      })

      // 通知投票结果
      const targetName = target ? `${target.gameNumber}号 ${target.name}` : '空刀'
      await role.sendPrivate(`你已投票击杀：${targetName}`)

      // 通知其他狼人投票更新
      await this.notifyVoteUpdate(player, targetId)

      // 检查是否所有狼人都已投票
      if (this.isAllWolvesVoted()) {
        await this.processVoteResult()
      }

      return true
    } catch (error) {
      if (!(error instanceof GameError)) console.error('[EliminationPhaseState] 处理狼人击杀失败:', error.message || error)
      throw error
    }
  }

  /**
   * 处理狼人跳过行动
   */
  async handleWolfSkip (player, role) {
    try {
      // 在投票阶段，跳过等同于空刀
      if (this.isVotingPhase) {
        return await this.handleWolfKill(player, role, null)
      }

      // 在讨论阶段，跳过表示不参与讨论
      await role.sendPrivate('你选择了跳过讨论')
      return true
    } catch (error) {
      console.error('[EliminationPhaseState] 处理狼人跳过失败:', error.message)
      throw error
    }
  }

  /**
   * 处理狼人自爆
   */
  async handleWolfSuicide (player, role) {
    try {
      const result = await role.suicide()

      if (result.success) {
        // 自爆成功，立即完成阶段
        await this.completePhase()
      }

      return result
    } catch (error) {
      console.error('[EliminationPhaseState] 处理狼人自爆失败:', error.message || error)
      throw error
    }
  }

  /**
   * 处理狼人讨论
   */
  async handleWolfDiscuss (player, role, message) {
    try {
      if (this.isVotingPhase) {
        await role.sendPrivate('投票阶段不能讨论，请专心投票')
        return false
      }

      // 记录讨论消息
      const discussionEntry = {
        playerId: player.id,
        playerName: player.name,
        message,
        timestamp: Date.now()
      }
      this.discussionMessages.push(discussionEntry)

      // 转发给其他狼人
      await this.broadcastDiscussion(player, message)

      return true
    } catch (error) {
      console.error('[EliminationPhaseState] 处理狼人讨论失败:', error.message || error)
      throw error
    }
  }

  /**
   * 处理准备投票
   */
  async handleReadyVote (player, role) {
    try {
      if (this.isVotingPhase) {
        await role.sendPrivate('已经在投票阶段了')
        return false
      }

      await role.sendPrivate('你提议进入投票阶段')

      // 检查是否所有狼人都准备好投票
      const aliveWolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })
      if (aliveWolves.length === 1) {
        // 单狼直接进入投票
        await this.startVotingPhase()
      } else {
        // 多狼需要协商，这里简化为立即进入投票
        await this.startVotingPhase()
      }

      return true
    } catch (error) {
      console.error('[EliminationPhaseState] 处理准备投票失败:', error.message || error)
      throw error
    }
  }

  /**
   * 广播讨论消息给其他狼人
   */
  async broadcastDiscussion (sender, message) {
    try {
      const aliveWolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })

      for (const { player, role } of aliveWolves) {
        if (player.id !== sender.id) {
          const broadcastMsg = `💬【${sender.name}】：${message}`
          await role.sendPrivate(broadcastMsg)
        }
      }
    } catch (error) {
      console.error('[EliminationPhaseState] 广播讨论消息失败:', error.message || error)
    }
  }

  /**
   * 通知投票更新
   */
  async notifyVoteUpdate (voter, targetId) {
    try {
      const aliveWolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })
      const targetName = targetId
        ? this.game.playerManager.getPlayerById(targetId)?.name || '未知'
        : '空刀'

      for (const { player, role } of aliveWolves) {
        if (player.id !== voter.id) {
          const updateMsg = `📊【投票更新】${voter.name} 投票击杀：${targetName}`
          await role.sendPrivate(updateMsg)
        }
      }
    } catch (error) {
      console.error('[EliminationPhaseState] 通知投票更新失败:', error.message || error)
    }
  }

  /**
   * 检查是否所有狼人都已投票
   */
  isAllWolvesVoted () {
    const aliveWolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })
    return this.wolfVotes.size >= aliveWolves.length
  }

  /**
   * 获取投票统计
   */
  getVoteCounts () {
    const voteCounts = new Map()

    for (const vote of this.wolfVotes.values()) {
      const targetId = vote.targetId
      const currentCount = voteCounts.get(targetId) || 0
      voteCounts.set(targetId, currentCount + 1)
    }

    return voteCounts
  }

  /**
   * 处理投票结果
   */
  async processVoteResult () {
    try {
      console.log('[EliminationPhaseState] 处理狼人投票结果')

      // 统计投票
      this.finalKillTarget = this.tallyVotes()

      // 通知投票结果
      await this.notifyVoteResult()

      // 执行击杀
      if (this.finalKillTarget) {
        await this.executeKill(this.finalKillTarget)
      }

      // 完成阶段
      await this.completePhase()
    } catch (error) {
      console.error('[EliminationPhaseState] 处理投票结果失败:', error.message || error)
      throw error
    }
  }

  /**
   * 统计投票结果
   */
  tallyVotes () {
    const voteCounts = this.getVoteCounts()
    let maxVotes = 0
    let maxTargets = []

    for (const [targetId, count] of voteCounts.entries()) {
      if (count > maxVotes) {
        maxVotes = count
        maxTargets = [targetId]
      } else if (count === maxVotes) {
        maxTargets.push(targetId)
      }
    }

    // 平票时返回null
    return maxTargets.length === 1 ? maxTargets[0] : null
  }

  /**
   * 通知投票结果
   */
  async notifyVoteResult () {
    try {
      const aliveWolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })
      let message

      if (!this.finalKillTarget) {
        message = '【最终结果】投票平局或全部空刀，今晚不会击杀任何人'
      } else {
        const target = this.game.playerManager.getPlayerById(this.finalKillTarget)
        message = `【最终结果】狼人队伍决定击杀 ${target.gameNumber}号 ${target.name}`
      }

      for (const { role } of aliveWolves) {
        await role.sendPrivate(message)
      }
    } catch (error) {
      console.error('[EliminationPhaseState] 通知投票结果失败:', error.message || error)
    }
  }

  /**
   * 执行击杀
   */
  async executeKill (targetId) {
    try {
      const target = this.game.playerManager.getPlayerById(targetId)
      if (!target) {
        console.error('[EliminationPhaseState] 击杀目标不存在:', targetId)
        return
      }

      // 检查是否被守卫保护
      if (target.protected) {
        console.log(`[EliminationPhaseState] ${target.name} 被守卫保护，击杀失败`)
        return
      }

      // 执行击杀
      await this.game.handlePlayerDeath(target, 'WOLF_KILL')
      console.log(`[EliminationPhaseState] 成功击杀 ${target.name}`)
    } catch (error) {
      console.error('[EliminationPhaseState] 执行击杀失败:', error.message || error)
    }
  }

  /**
   * 处理投票超时
   */
  async handleVotingTimeout () {
    try {
      console.log('[EliminationPhaseState] 投票阶段超时')

      // 为未投票的狼人设置默认空刀
      const aliveWolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })

      for (const { player } of aliveWolves) {
        if (!this.wolfVotes.has(player.id)) {
          this.wolfVotes.set(player.id, {
            wolfId: player.id,
            targetId: null,
            timestamp: Date.now(),
            isTimeout: true
          })
        }
      }

      // 处理投票结果
      await this.processVoteResult()
    } catch (error) {
      console.error('[EliminationPhaseState] 处理投票超时失败:', error.message || error)
    }
  }

  async onResume () {
    if (this.isPhaseCompleted) return
    if (!this.isVotingPhase) {
      this.discussionTimeout = setTimeout(async () => {
        if (!this.isVotingPhase && !this.isPhaseCompleted) {
          await this.startVotingPhase()
        }
      }, this.discussionTime)
    } else {
      this.votingTimeout = setTimeout(async () => {
        if (!this.isPhaseCompleted) {
          await this.handleVotingTimeout()
        }
      }, this.votingTime)
    }
  }

  /**
   * 验证特定行动的有效性
   */
  validateSpecificAction (player, action) {
    try {
      const role = this.game.playerManager.roles.get(player.id)
      if (!role || role.constructor.name !== 'WolfRole') {
        return false
      }

      // 验证角色是否可以在当前状态下行动
      if (!role.canAct(this)) {
        return false
      }

      // 验证狼人特定行动
      const validActions = [ACTIONS.KILL, ACTIONS.SKIP, ACTIONS.SUICIDE, 'discuss', 'ready_vote']
      return validActions.includes(action)
    } catch (error) {
      console.error('[EliminationPhaseState] 验证特定行动失败:', error.message || error)
      return false
    }
  }

  /**
   * 处理超时行动
   */
  async handleTimeoutActions () {
    try {
      console.log('[EliminationPhaseState] 处理消除阶段超时')

      if (!this.isVotingPhase) {
        // 讨论阶段超时，进入投票阶段
        await this.startVotingPhase()
      } else {
        // 投票阶段超时
        await this.handleVotingTimeout()
      }
    } catch (error) {
      console.error('[EliminationPhaseState] 处理超时行动失败:', error.message || error)
    }
  }

  /**
   * 阶段完成时的处理逻辑
   */
  async onPhaseComplete () {
    try {
      console.log('[EliminationPhaseState] 消除阶段完成')

      // 输出阶段统计信息
      const stats = this.getPhaseStats()
      console.log('[EliminationPhaseState] 阶段统计:', {
        狼人投票数: this.wolfVotes.size,
        讨论消息数: this.discussionMessages.length,
        最终击杀目标: this.finalKillTarget,
        阶段耗时: stats.duration
      })

      // 移除emit调用，父类会处理回调机制
    } catch (error) {
      console.error('[EliminationPhaseState] 阶段完成处理失败:', error.message || error)
      throw error // 抛出错误让父类处理
    }
  }

  /**
   * 清理阶段资源
   */
  async cleanupPhase () {
    try {
      // 清理定时器
      if (this.discussionTimeout) {
        clearTimeout(this.discussionTimeout)
        this.discussionTimeout = null
      }
      if (this.votingTimeout) {
        clearTimeout(this.votingTimeout)
        this.votingTimeout = null
      }

      // 清理阶段特有的数据
      this.wolfVotes.clear()
      this.discussionMessages.length = 0
      this.finalKillTarget = null
      this.isVotingPhase = false

      // 调用父类清理方法
      await super.cleanupPhase()

      console.log('[EliminationPhaseState] 消除阶段资源清理完成')
    } catch (error) {
      console.error('[EliminationPhaseState] 清理阶段资源失败:', error.message || error)
    }
  }

  /**
   * 获取阶段特定的统计信息
   */
  getPhaseStats () {
    const baseStats = super.getPhaseStats()

    return {
      ...baseStats,
      wolfVotes: this.wolfVotes.size,
      discussionMessages: this.discussionMessages.length,
      finalKillTarget: this.finalKillTarget,
      isVotingPhase: this.isVotingPhase,
      discussionDuration: this.discussionStartTime
        ? (this.votingStartTime || Date.now()) - this.discussionStartTime
        : 0,
      votingDuration: this.votingStartTime
        ? Date.now() - this.votingStartTime
        : 0
    }
  }
}
