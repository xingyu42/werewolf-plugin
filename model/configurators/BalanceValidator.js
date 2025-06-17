import { RoleData } from './RoleData.js'
import { BALANCE_THRESHOLDS } from '../core/Constants.js'

/**
 * 游戏配置平衡性验证器
 *
 * 集中处理所有与游戏配置平衡性相关的计算与验证逻辑，
 * 确保所有配置生成都遵循统一、可维护的平衡标准。
 *
 * 现在使用统一的常量定义，避免重复定义阈值
 */
export class BalanceValidator {
  // 平衡性阈值常量 - 使用统一定义
  static get EVIL_RATIO_RANGE () {
    return [BALANCE_THRESHOLDS.EVIL_RATIO_MIN, BALANCE_THRESHOLDS.EVIL_RATIO_MAX]
  }

  static get WOLF_RATIO_RANGE () {
    return [BALANCE_THRESHOLDS.WOLF_RATIO_MIN, BALANCE_THRESHOLDS.WOLF_RATIO_MAX]
  }

  /**
   * 计算模板中各阵营的力量值和狼人数量
   * @private
   * @param {Array<string>} template - 角色配置数组
   * @returns {{goodPower: number, evilPower: number, wolfCount: number}}
   */
  static _calculatePower (template) {
    let goodPower = 0
    let evilPower = 0
    let wolfCount = 0

    for (const role of template) {
      const weight = RoleData.getWeight(role)
      if (weight > 0) {
        goodPower += weight
      } else if (weight < 0) {
        evilPower += Math.abs(weight)
      }

      if (RoleData.isWolf(role)) {
        wolfCount++
      }
    }

    return { goodPower, evilPower, wolfCount }
  }

  /**
   * 验证配置是否平衡
   * 基于PRD中的游戏平衡验证指标进行验证
   * @param {Array<string>} template - 角色配置
   * @returns {{isValid: boolean, reason: string, details: Object}} 包含验证结果的对象
   */
  static validate (template) {
    if (!template || !Array.isArray(template) || template.length === 0) {
      return { isValid: false, reason: '无效的配置模板', details: {} }
    }

    const playerCount = template.length
    const { goodPower, evilPower, wolfCount } = this._calculatePower(template)

    const totalPower = goodPower + evilPower
    if (totalPower === 0) {
      return { isValid: false, reason: '总权重为零，无法计算平衡性', details: {} }
    }

    const evilRatio = evilPower / totalPower
    const wolfRatio = wolfCount / playerCount

    const details = { evilRatio, wolfRatio, goodPower, evilPower }

    // 验证阵营力量比
    if (evilRatio < this.EVIL_RATIO_RANGE[0] || evilRatio > this.EVIL_RATIO_RANGE[1]) {
      return {
        isValid: false,
        reason: `阵营力量比不平衡: ${evilRatio.toFixed(2)}，应在${this.EVIL_RATIO_RANGE.join('-')}之间`,
        details
      }
    }

    // 验证狼人比例
    if (wolfRatio < this.WOLF_RATIO_RANGE[0] || wolfRatio > this.WOLF_RATIO_RANGE[1]) {
      return {
        isValid: false,
        reason: `狼人比例不合理: ${(wolfRatio * 100).toFixed(0)}%，应在${(this.WOLF_RATIO_RANGE[0] * 100).toFixed(0)}%- ${(this.WOLF_RATIO_RANGE[1] * 100).toFixed(0)}%之间`,
        details
      }
    }

    // 验证特殊角色是否符合解锁规则
    for (const role of template) {
      const minCount = RoleData.getUnlockCount(role)
      if (playerCount < minCount) {
        return {
          isValid: false,
          reason: `角色${role}需要至少${minCount}名玩家才能解锁`,
          details
        }
      }
    }

    return {
      isValid: true,
      reason: '配置平衡',
      details
    }
  }

  /**
   * 计算配置的平衡度评分
   * @param {Array<string>} template - 角色配置
   * @returns {number} 平衡度评分（0-100，越高越平衡）
   */
  static calculateBalanceScore (template) {
    const validation = this.validate(template)
    if (!validation.isValid) {
      return 0
    }

    // 理想的阵营力量比为0.5，与此的接近程度决定评分
    const balanceDeviation = Math.abs(validation.details.evilRatio - 0.5)
    // 理想的狼人比例为0.25，与此的接近程度也影响评分
    const wolfRatioDeviation = Math.abs(validation.details.wolfRatio - 0.25)

    // 根据偏差计算评分，偏差越小，评分越高
    // 最大偏差0.1，扣100分 ( (0.1 / (0.6-0.5)) * 100 )
    const balanceScore = Math.max(0, 100 - balanceDeviation * 1000)
    // 最大偏差0.1，扣100分 ( (0.1 / (0.35-0.25)) * 100 )
    const wolfRatioScore = Math.max(0, 100 - wolfRatioDeviation * 1000)

    // 综合评分，平衡性占60%，狼人比例占40%
    return Math.round(balanceScore * 0.6 + wolfRatioScore * 0.4)
  }
}
