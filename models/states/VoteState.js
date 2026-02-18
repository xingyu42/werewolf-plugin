/**
 * @file VoteState.js
 * @description 投票状态类，处理玩家投票和放逐逻辑
 * @module model/strategies/states/VoteState
 *
 * @input GameState, NightPhaseController, LastWordsState, Puppeteer
 * @output VoteState - 投票状态类
 * @pos 策略层 - 白天投票阶段
 *
 * @dependencies
 * - ./GameState.js - 状态基类
 * - ./NightPhaseController.js - 夜晚控制器
 * - ./LastWordsState.js - 遗言状态
 * - ../../../components/services.js - 渲染服务
 */
import { GameState } from './GameState.js'
import { NightPhaseController } from './NightPhaseController.js'
import { LastWordsState } from './LastWordsState.js'
import Puppeteer from '../../utils/Puppeteer.js'

export class VoteState extends GameState {
  constructor (game) {
    super(game)
    this.timeLimit = 0 // 禁用基类定时器，使用自有 voteTimeout
    this._voteTimeLimit = game.getConfig().game.voteTimeLimit
    this.votes = new Map() // 记录投票情况
    this.votedPlayers = new Set() // 已经投票的玩家
    this._resolved = false // resolveVotes 幂等锁
    this.ABSTAIN = 'ABSTAIN' // 弃票标记
  }

  async onEnter () {
    await super.onEnter()
    this.votes.clear()
    this.votedPlayers.clear() // 清空已投票玩家

    // 通知所有存活玩家开始投票
    this.e.reply('开始投票,请存活的玩家#投票*号')

    // 显示可投票的玩家列表
    const playerList = [...this.game.players.values()]
      .filter((p) => p.isAlive)
      .map((p) => `${p.gameNumber}:${p.name}`)
      .join('\n')

    this.e.reply(playerList)

    // 设置投票时间限制
    this.voteTimeout = setTimeout(async () => {
      await this.onTimeout() // 超时处理
    }, this._voteTimeLimit * 1000)
  }

  // 处理投票
  async handleAction (player, action, targetId) {
    if (!this.isValidAction(player, action, targetId)) {
      throw new Error('非法操作')
    }

    // 记录投票
    if (action === 'abstain') {
      this.votes.set(player.id, this.ABSTAIN)
      this.e.reply(`${player.name}选择弃票`)
    } else {
      this.votes.set(player.id, targetId)
      this.e.reply(`${player.name}完成投票`)
    }

    this.votedPlayers.add(player.id) // 添加到已投票玩家集合

    // 检查是否所有人都投票完成
    if (this.isAllVoted()) {
      await this.resolveVotes()
    }
  }

  // 检查行动是否有效
  isValidAction (player, action, targetId) {
    if (!player || !player.isAlive) return false
    if (action !== 'vote' && action !== 'abstain') return false
    if (this.votes.has(player.id)) return false // 已经投过票

    // 如果是投票操作,验证目标是否有效
    if (action === 'vote') {
      const target = this.game.players.get(targetId)
      if (!target || !target.isAlive) return false
    }

    return true
  }

  // 检查是否所有人都投票了
  isAllVoted () {
    const alivePlayers = [...this.game.players.values()].filter((p) => p.isAlive)
    return this.votedPlayers.size >= alivePlayers.length
  }

  // 统计投票结果
  tallyVotes () {
    const results = new Map()
    this.votes.forEach((targetId, voterId) => {
      // 不统计弃票
      if (targetId !== this.ABSTAIN) {
        // 获取投票者是否是警长
        const voter = this.game.players.get(voterId)
        const voteWeight = voter.isSheriff ? 1.5 : 1
        results.set(targetId, (results.get(targetId) || 0) + voteWeight)
      }
    })
    return results
  }

  // 清空投票记录
  resetVotes () {
    this.votes.clear()
    this.votedPlayers.clear()
  }

  // 处理投票结果
  async resolveVotes () {
    // 幂等锁：防止超时 + 全员投票同时触发
    if (this._resolved) return
    this._resolved = true

    // 清除定时器
    if (this.voteTimeout) {
      clearTimeout(this.voteTimeout)
      this.voteTimeout = null
    }

    // 统计票数
    const voteCount = this.tallyVotes()

    // 找出最高票数的玩家
    let maxVotes = 0
    let votedPlayers = []
    for (const [targetId, count] of voteCount.entries()) {
      if (count > maxVotes) {
        maxVotes = count
        votedPlayers = [targetId]
      } else if (count === maxVotes) {
        votedPlayers.push(targetId)
      }
    }

    // 组织渲染数据
    const voteData = {
      exiled: null,
      others: [],
      abstained: []
    }

    // 处理投票数据
    this.votes.forEach((targetId, voterId) => {
      const voter = this.game.players.get(voterId)
      const voterInfo = {
        number: voterId,
        isSheriff: voter.isSheriff
      }

      if (targetId === this.ABSTAIN) {
        voteData.abstained.push(voterInfo)
      } else {
        // 找到或创建目标玩家的投票记录
        const targetPlayer = this.game.players.get(targetId)
        const targetNumber = targetPlayer?.gameNumber ?? targetId
        let targetVotes = voteData.others.find(v => v.number === targetNumber)
        if (!targetVotes) {
          targetVotes = { number: targetNumber, voters: [] }
          voteData.others.push(targetVotes)
        }
        targetVotes.voters.push(voterInfo)
      }
    })

    // 如果有放逐目标,将其从others移到exiled
    if (votedPlayers.length === 1) {
      const exiledPlayer = this.game.players.get(votedPlayers[0])
      const exiledNumber = exiledPlayer?.gameNumber ?? votedPlayers[0]
      const exiledIndex = voteData.others.findIndex(v => v.number === exiledNumber)
      if (exiledIndex !== -1) {
        voteData.exiled = voteData.others.splice(exiledIndex, 1)[0]
      }
    }

    // 按票数排序其他投票
    voteData.others.sort((a, b) => {
      const aVotes = a.voters.reduce((sum, voter) => sum + (voter.isSheriff ? 1.5 : 1), 0)
      const bVotes = b.voters.reduce((sum, voter) => sum + (voter.isSheriff ? 1.5 : 1), 0)
      return bVotes - aVotes
    })

    // 渲染投票结果
    const base64 = await Puppeteer.render('vote/vote-result', { voteResult: voteData })
    if (base64) {
      this.e.reply(base64)
    }

    // 检查是否达到最低票数要求
    const minVotes = this.game.getConfig().game.minVotesToKill // 最少投票数
    if (maxVotes <= minVotes) {
      this.e.reply('没有玩家得票数超过最低要求,无人出局')
      await this.game.changeState(new NightPhaseController(this.game))
      return
    }

    // 如果有平票,则无人出局
    if (votedPlayers.length > 1) {
      this.e.reply('出现平票,无人出局')
      await this.game.changeState(new NightPhaseController(this.game))
      return
    }

    // 处理出局玩家
    const votedId = votedPlayers[0]
    const votedPlayer = this.game.players.get(votedId)

    // 先处理玩家死亡
    const gameOver = await this.game.handlePlayerDeath(votedPlayer, 'EXILE')
    this.e.reply(`${votedPlayer.name}被投票放逐出局`)

    // 游戏已结束，不再创建后续状态
    if (gameOver) return

    // 创建下一个状态（夜晚）
    const nextState = new NightPhaseController(this.game)

    // 进入遗言阶段，并传入下一个状态
    await this.game.changeState(new LastWordsState(this.game, nextState, votedPlayer))
  }

  // 超时处理
  async onTimeout () {
    if (this.voteTimeout) {
      clearTimeout(this.voteTimeout)
      this.voteTimeout = null
    }
    await this.resolveVotes()
  }
}
