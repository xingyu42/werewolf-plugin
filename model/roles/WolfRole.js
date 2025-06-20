import { Role } from './Role.js'
import { CAMPS } from '../core/Constants.js'

/**
 * 狼人角色类
 *
 * 狼人是狼人阵营的核心角色，具有以下能力：
 * - 每晚可以投票选择击杀目标
 * - 通过投票机制与其他狼人协作
 * - 可以进行队内沟通
 * - 根据配置可能具有自爆能力
 * - 只能在夜晚阶段行动
 *
 * 注意：此类使用静态属性管理所有狼人的投票状态，需要在游戏结束时清理
 *
 * @class WolfRole
 * @extends Role
 */
export class WolfRole extends Role {
  /** @type {Map<string, Object>} 静态属性存储所有狼人投票 */
  static wolfVotes = new Map()

  /** @type {string|null} 最终击杀目标ID */
  static wolfKillTarget = null

  /**
   * 创建狼人角色实例
   *
   * @param {Object} game - 游戏实例
   * @param {Object} player - 玩家对象
   * @param {Object} e - 事件对象
   */
  constructor (game, player, e) {
    super(game, player, e)
    this.name = '狼人'
    this.canSuicide = game.getConfig().roles.enableWolfSuicide
  }

  /**
   * 清理静态数据，防止跨游戏数据污染
   *
   * @static
   */
  static cleanup () {
    console.log('[WolfRole] 清理静态数据...')
    this.wolfVotes.clear()
    this.wolfKillTarget = null
    console.log('[WolfRole] 静态数据清理完成')
  }

  /**
   * 获取静态数据统计信息
   *
   * @static
   * @returns {Object} 包含投票数量和击杀目标信息的统计对象
   */
  static getStats () {
    return {
      voteCount: this.wolfVotes.size,
      hasKillTarget: this.wolfKillTarget !== null,
      killTarget: this.wolfKillTarget
    }
  }

  /**
   * 获取角色阵营
   *
   * @returns {string} 返回狼人阵营标识
   */
  getCamp () {
    return CAMPS.WOLF
  }

  /**
   * 检查是否可以在当前阶段行动
   *
   * @param {Object} state - 当前游戏状态
   * @returns {boolean} 狼人只能在夜晚阶段行动
   */
  canAct (state) {
    return state.getName() === 'NightState'
  }

  /**
   * 获取狼人行动提示消息
   *
   * 包含存活玩家列表、其他狼人信息和当前投票状态
   *
   * @returns {string} 行动提示消息
   */
  getActionPrompt () {
    const aliveWolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })
    let wolfList = ''
    if (aliveWolves.length > 0) {
      wolfList = '\n\n其他存活狼人：\n' + aliveWolves.map((w) => `${w.player.name}`).join('、')
    }

    // 获取当前投票状态
    let voteStatus = ''
    if (this.game.currentState.getName() === 'NightState') {
      const voteCounts = this.game.currentState.getWolfVoteCounts()
      if (voteCounts.size > 0) {
        voteStatus = '\n\n当前投票情况：\n'
        for (const [targetId, count] of voteCounts.entries()) {
          if (targetId === null) continue // 跳过弃权票
          const target = this.game.players.get(targetId)
          if (target) {
            voteStatus += `${target.name}: ${count}票\n`
          }
        }
      }
    }

    return `【狼人】请选择今晚的击杀目标：
${this.getAlivePlayersList().join('\n')}
输入格式：#刀*号${wolfList}${voteStatus}

你也可以与其他狼人进行队内沟通，输入格式：#讨论 你想说的话`
  }

  /**
   * 检查击杀目标是否合法
   *
   * @param {Object} target - 目标玩家对象
   * @returns {boolean} 目标是否合法
   */
  isValidTarget (target) {
    if (!super.isValidTarget(target)) return false

    // 不能杀害同伴
    if (target.id === this.player.id) return false
    const targetRole = this.game.roles.get(target.id)
    if (targetRole.getCamp() === 'WOLF') return false

    return true
  }

  /**
   * 处理狼人投票
   *
   * @async
   * @param {string|null} targetId - 目标玩家ID，null表示弃权
   * @returns {Promise<boolean>} 是否所有狼人都已投票完成
   */
  async handleVote (targetId) {
    // 记录投票 (targetId 为 null 时表示弃权)
    WolfRole.wolfVotes.set(this.player.id, {
      wolfId: this.player.id,
      targetId,
      timestamp: Date.now()
    })

    // 通知其他狼人
    await this.notifyVoteUpdate(targetId)

    // 检查是否所有狼人都已投票
    if (this.isAllWolvesVoted()) {
      // 确定最终目标
      WolfRole.wolfKillTarget = this.tallyVotes()

      // 通知结果
      await this.notifyVoteResult()

      // 执行击杀(如果有目标)
      if (WolfRole.wolfKillTarget) {
        const target = this.game.players.get(WolfRole.wolfKillTarget)
        if (target) {
          await this.act(target, 'kill')
        }
      }

      return true
    }

    return false
  }

  /**
   * 通知其他狼人新投票
   *
   * @async
   * @param {string|null} targetId - 投票目标ID
   */
  async notifyVoteUpdate (targetId) {
    const wolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })
    const voterNumber = this.game.getPlayerNumber(this.player.id)

    let voteMsg
    if (targetId === null) {
      voteMsg = `【投票更新】狼人${voterNumber}号(${this.player.name})选择弃权`
    } else {
      const target = this.game.players.get(targetId)
      voteMsg = `【投票更新】狼人${voterNumber}号(${this.player.name})投票击杀${target.name}`
    }

    let voteStatus = '\n当前投票情况：\n'

    // 获取投票统计
    const voteCounts = this.getVoteCounts()
    for (const [tId, count] of voteCounts.entries()) {
      if (tId === null) {
        voteStatus += `弃权: ${count}票\n`
      } else {
        const target = this.game.players.get(tId)
        if (target) {
          voteStatus += `${target.name}: ${count}票\n`
        }
      }
    }

    // 添加未投票狼人
    const unvotedWolves = this.getUnvotedWolves()
    if (unvotedWolves.length > 0) {
      voteStatus += '\n未投票狼人：' + unvotedWolves.map(w => w.name).join('、')
    }

    // 通知其他狼人
    for (const wolf of wolves) {
      if (wolf.id !== this.player.id) {
        await this.sendPrivate(voteMsg + '\n' + voteStatus, wolf.id)
      }
    }
  }

  /**
   * 通知投票结果
   *
   * @async
   */
  async notifyVoteResult () {
    const wolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })
    let message

    if (!WolfRole.wolfKillTarget) {
      // 区分是否因为全部弃权
      const allSkipped = [...WolfRole.wolfVotes.values()].every(v => v.targetId === null)
      message = allSkipped
        ? '【最终结果】所有狼人选择弃权，今晚不会击杀任何人'
        : '【最终结果】由于投票平局，今晚狼人无法达成一致，不会击杀任何人'
    } else {
      const target = this.game.players.get(WolfRole.wolfKillTarget)
      message = `【最终结果】狼人队伍决定击杀${target.name}`
    }

    for (const wolf of wolves) {
      await this.sendPrivate(message, wolf.id)
    }
  }

  /**
   * 获取投票统计
   *
   * @returns {Map<string|null, number>} 投票统计Map，键为目标ID，值为票数
   */
  getVoteCounts () {
    const voteCounts = new Map()
    for (const vote of WolfRole.wolfVotes.values()) {
      const targetId = vote.targetId
      voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1)
    }
    return voteCounts
  }

  /**
   * 统计最终结果
   *
   * @returns {string|null} 最终击杀目标ID，平局时返回null
   */
  tallyVotes () {
    const aliveWolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })

    // 单狼直接返回
    if (aliveWolves.length === 1) {
      const vote = WolfRole.wolfVotes.get(aliveWolves[0].id)
      return vote ? vote.targetId : null
    }

    // 统计票数
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

    return maxTargets.length === 1 ? maxTargets[0] : null
  }

  /**
   * 检查是否所有狼人已投票
   *
   * @returns {boolean} 是否所有存活狼人都已投票
   */
  isAllWolvesVoted () {
    const aliveWolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })
    return aliveWolves.every(wolf => WolfRole.wolfVotes.has(wolf.id))
  }

  /**
   * 获取未投票狼人
   *
   * @returns {Array<Object>} 未投票的狼人玩家对象数组
   */
  getUnvotedWolves () {
    const aliveWolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })
    return aliveWolves.filter(wolf => !WolfRole.wolfVotes.has(wolf.id))
  }

  /**
   * 执行狼人行动
   *
   * @async
   * @param {Object} target - 目标玩家对象
   * @param {string} [action='kill'] - 行动类型
   * @returns {Promise<boolean|Object>} 行动结果
   */
  async act (target, action = 'kill') {
    if (action === 'vote') {
      // 空刀逻辑
      if (!target) {
        try {
          const result = await this.handleVote(null)
          await this.sendPrivate('你选择了放弃击杀')
          return { success: true, message: '成功选择放弃击杀', completed: result }
        } catch (error) {
          console.error('WolfRole.act: 处理弃权投票失败:', error)
          return { success: false, message: `弃权投票失败: ${error.message || '未知错误'}` }
        }
      }

      // 正常投票逻辑
      if (!this.isValidTarget(target)) {
        try {
          const result = await this.handleVote(target.id)
          await this.sendPrivate(`你已投票击杀${target.name}`)
          return { success: true, message: `成功投票击杀${target.name}`, completed: result }
        } catch (error) {
          console.error('WolfRole.act: 处理投票失败:', error)
          return { success: false, message: `投票失败: ${error.message || '未知错误'}` }
        }
      }

      if (action === 'kill') {
        if (!target) return true // 空刀直接返回成功
        if (target.protected) {
          await this.reply(`${target.name}被守卫保护，无法击杀`)
          return false
        }
        await this.game.handlePlayerDeath(target, 'WOLF_KILL')
        return true
      }

      return false
    }
  }

  /**
   * 狼人自爆
   *
   * @async
   * @returns {Promise<Object>} 自爆结果对象 {success: boolean, message: string}
   */
  async suicide () {
    if (!this.canSuicide) {
      return { success: false, message: '当前游戏不允许狼人自爆' }
    }

    try {
      // 自爆会立即死亡，通过游戏核心处理死亡逻辑，而不是直接修改状态
      await this.game.handlePlayerDeath(this.player, 'SUICIDE')

      // 通知所有玩家
      await this.reply(`${this.player.name}选择自爆,身份是狼人`)

      // 跳过当前阶段
      await this.game.currentState.onTimeout()

      return { success: true, message: '自爆成功' }
    } catch (error) {
      console.error('WolfRole.suicide: 自爆失败:', error)
      return { success: false, message: `自爆失败: ${error.message || '未知错误'}` }
    }
  }

  /**
   * 狼人队内沟通
   *
   * @async
   * @param {string} message - 要发送的消息内容
   * @returns {Promise<Object>} 沟通结果对象 {success: boolean, message: string}
   */
  async discuss (message) {
    // 检查当前是否为夜晚阶段
    if (this.game.currentState.getName() !== 'NightState') {
      return { success: false, message: '只有在夜晚阶段才能使用狼人队内沟通' }
    }

    // 获取其他存活的狼人
    const wolves = this.game.getAlivePlayers({ roleType: 'WolfRole', includeRole: true })
    if (wolves.length === 0) {
      return { success: false, message: '没有其他存活的狼人可以沟通' }
    }

    try {
      // 构建消息前缀，包含狼人编号和名称
      const playerNumber = this.game.getPlayerNumber(this.player.id)
      const prefix = `[狼人${playerNumber}号-${this.player.name}]：`

      // 添加时间戳
      const now = new Date()
      const timestamp = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`

      // 完整消息
      const fullMessage = `${timestamp} \n${prefix}${message}`

      // 转发消息给其他狼人
      for (const wolf of wolves) {
        await this.sendPrivate(fullMessage, wolf.player.id)
      }

      // 给发送者一个确认
      await this.sendPrivate('消息已发送给其他狼人')

      return { success: true, message: '消息发送成功' }
    } catch (error) {
      console.error('WolfRole.discuss: 队内沟通失败:', error)
      return { success: false, message: `队内沟通失败: ${error.message || '未知错误'}` }
    }
  }
}
