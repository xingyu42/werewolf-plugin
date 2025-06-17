import { Role } from './Role.js'
import { ValidationUtils } from '../utils/ValidationUtils.js'

export class ProphetRole extends Role {
  constructor (game, player, e) {
    super(game, player, e)
    this.checkHistory = new Map() // 查验历史记录
  }

  canAct (state) {
    return state.getName() === 'NightState'
  }

  getActionPrompt () {
    let historyInfo = ''
    if (this.checkHistory && this.checkHistory.size > 0) {
      try {
        historyInfo =
          '\n\n已查验玩家：\n' +
          Array.from(this.checkHistory.entries())
            .map(([id, data]) => {
              // 增强数据验证
              if (!data || typeof data !== 'object' || !data.result) {
                console.warn(`getActionPrompt: 无效的查验数据 for player ${id}`)
                return null
              }

              if (!this.game || !this.game.players) {
                console.error('getActionPrompt: game.players 未初始化')
                return `${id}：${data.result}`
              }

              const player = this.game.players.get(id)
              if (!player) {
                console.warn(`getActionPrompt: 找不到玩家 ${id}`)
                return `${id}：${data.result}`
              }

              const playerName = player.name || '未知玩家'
              return `${playerName}：${data.result}`
            })
            .filter(entry => entry !== null) // 过滤无效条目
            .join('\n')
      } catch (error) {
        console.error('getActionPrompt: 构建历史信息时发生错误:', error)
        historyInfo = '\n\n查验历史获取失败'
      }
    }

    const alivePlayersList = this.getAlivePlayersList()
    return `【预言家】请选择今晚的查验目标：\n ${alivePlayersList} \n 输入格式：#查验*号 \n ${historyInfo}`
  }

  // 检查目标是否合法
  isValidTarget (target) {
    if (!super.isValidTarget(target)) return false

    // 不能查验自己
    if (target.id === this.player.id) return false

    return true
  }

  // 预言家查验
  async act (target, action = 'check') {
    if (!target) {
      console.debug('ProphetRole.act: target 为空')
      return false
    }

    if (!this.isValidTarget(target)) {
      await this.sendPrivate('非法目标')
      return false
    }

    try {
      let result
      const timestamp = Date.now()

      // 使用 ValidationUtils 验证角色数据
      const roleValidation = ValidationUtils.validateRole(this.game, target.id)
      if (!roleValidation.isValid) {
        console.error(`ProphetRole.act: ${roleValidation.error.message}`)
        await this.sendPrivate('目标角色不存在')
        return false
      }

      const targetRole = roleValidation.role

      // 查验阵营
      let isGood
      try {
        const camp = await targetRole.getCamp()
        isGood = camp !== 'WOLF'
      } catch (error) {
        console.error('ProphetRole.act: 获取阵营信息失败:', error)
        await this.sendPrivate('查验失败，请稍后重试')
        return false
      }

      const targetName = target.name || '未知玩家'
      result = `${targetName}是${isGood ? '好人' : '狼人'}`

      // 记录查验结果
      if (!this.checkHistory) {
        this.checkHistory = new Map()
      }

      this.checkHistory.set(target.id, {
        result,
        timestamp,
        turn: this.game.turn || 0
      })

      // 发送查验结果
      const turnInfo = this.game.turn || 0
      const timeInfo = new Date(timestamp).toLocaleTimeString()
      await this.sendPrivate(`${result} (查验时间: 第${turnInfo}天 ${timeInfo})`)

      return result
    } catch (error) {
      console.error('ProphetRole.act: 查验过程中发生错误:', error)
      await this.sendPrivate('查验失败，请稍后重试')
      return false
    }
  }

  // 获取查验历史
  getCheckHistory (targetId) {
    return this.checkHistory.get(targetId)
  }

  // 验证查验记录
  verifyCheckRecord (targetId, record) {
    const storedRecord = this.checkHistory.get(targetId)
    if (!storedRecord) return false
    return storedRecord.timestamp === record.timestamp && storedRecord.turn === record.turn
  }
}
