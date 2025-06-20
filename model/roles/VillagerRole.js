import { Role } from './Role.js'

/**
 * 村民角色类
 *
 * 村民是好人阵营的基础角色，具有以下特点：
 * - 没有特殊的夜晚技能
 * - 只能在白天参与投票和讨论
 * - 通过推理和分析帮助好人阵营获胜
 * - 是游戏中数量最多的角色
 *
 * @class VillagerRole
 * @extends Role
 */
export class VillagerRole extends Role {
  /**
   * 创建村民角色实例
   *
   * @param {Object} game - 游戏实例
   * @param {Object} player - 玩家对象
   * @param {Object} e - 事件对象
   */
  constructor (game, player, e) {
    super(game, player, e)
    this.name = '村民'
  }

  /**
   * 获取村民的行动提示消息
   *
   * 村民在夜晚没有特殊技能，只能等待天亮
   *
   * @returns {string} 夜晚等待提示消息
   */
  getActionPrompt () {
    return '【村民】夜晚请安心休息，等待天亮参与讨论和投票'
  }
}
