/**
 * @file RoleData.js
 * @description 角色数据管理，提供角色权重、阵营、解锁条件等属性查询
 * @module utils/configurators/RoleData
 *
 * @input Constants (../../model/core/Constants.js) - ROLES, CAMPS, ROLE_WEIGHTS, ROLE_CAMPS, ROLE_NAMES_CN
 * @output RoleData - 角色数据查询类
 * @pos 工具层 - 角色元数据提供者，为配置生成器和验证器提供数据支持
 *
 * @dependencies
 * - ../../model/core/Constants.js - 统一的角色常量定义（权重、阵营、名称）
 */
import { ROLES, CAMPS, ROLE_WEIGHTS, ROLE_CAMPS, ROLE_NAMES_CN } from '../../model/core/Constants.js'

export class RoleData {
  /**
   * 角色权重映射
   * 使用统一的常量定义，避免重复
   * @deprecated 请直接使用 ROLE_WEIGHTS 常量
   */
  static get roleWeights () {
    return ROLE_WEIGHTS
  }

  /**
   * 角色阵营映射
   * 使用统一的常量定义，避免重复
   * @deprecated 请直接使用 ROLE_CAMPS 常量
   */
  static get roleCamps () {
    return ROLE_CAMPS
  }

  /**
   * 角色解锁人数映射
   * 定义每个角色在最少多少人的游戏中才能出现
   * 基于PRD中的特殊角色解锁原则
   * 使用统一的角色常量
   */
  static roleUnlockCount = {
    [ROLES.WOLF]: 6, // 基础角色，至少6人
    [ROLES.VILLAGER]: 6, // 基础角色，至少6人
    [ROLES.PROPHET]: 6, // 基础角色，至少6人
    [ROLES.WITCH]: 6, // 基础角色，至少6人
    [ROLES.HUNTER]: 8, // 8人及以上解锁
    [ROLES.GUARD]: 9 // 9人及以上解锁
  }

  /**
   * 角色描述映射
   * 为每个角色提供简短的描述
   * 使用统一的角色常量
   */
  static roleDescriptions = {
    [ROLES.WOLF]: '每晚可以杀死一名玩家',
    [ROLES.VILLAGER]: '没有特殊技能的普通村民',
    [ROLES.PROPHET]: '每晚可以查验一名玩家的身份',
    [ROLES.WITCH]: '拥有一瓶救人药和一瓶毒药',
    [ROLES.HUNTER]: '被杀死后可以开枪带走一名玩家',
    [ROLES.GUARD]: '每晚可以保护一名玩家不被狼人杀死'
  }

  /**
   * 获取角色权重
   * @param {string} roleName - 角色名称
   * @returns {number} 角色权重值
   */
  static getWeight (roleName) {
    if (!roleName || typeof roleName !== 'string') {
      console.warn('无效的角色名称')
      return 0
    }

    const weight = RoleData.roleWeights[roleName]
    if (weight === undefined) {
      console.warn(`未知角色: ${roleName}，使用默认权重0`)
      return 0
    }

    return weight
  }

  /**
   * 获取角色阵营
   * 与RoleFactory.getRoleCamp保持一致
   * @param {string} roleName - 角色名称
   * @returns {string} 角色阵营 ("WOLF" | "VILLAGER" | "GOD")
   * @throws {Error} 当角色类型未知时抛出错误
   */
  static getCamp (roleName) {
    if (!roleName || typeof roleName !== 'string') {
      throw new Error('无效的角色名称')
    }

    const camp = RoleData.roleCamps[roleName]
    if (!camp) {
      throw new Error(`未知的角色类型: ${roleName}`)
    }

    return camp
  }

  /**
   * 获取角色在游戏中解锁所需的最小人数
   * @param {string} roleName - 角色名称
   * @returns {number} 解锁所需的最小人数
   */
  static getUnlockCount (roleName) {
    if (!roleName || typeof roleName !== 'string') {
      console.warn('无效的角色名称')
      return 6 // 默认最低人数
    }

    const unlockCount = RoleData.roleUnlockCount[roleName]
    if (unlockCount === undefined) {
      console.warn(`未知角色: ${roleName}，使用默认解锁人数6`)
      return 6
    }

    return unlockCount
  }

  /**
   * 获取角色描述
   * @param {string} roleName - 角色名称
   * @returns {string} 角色描述
   */
  static getDescription (roleName) {
    if (!roleName || typeof roleName !== 'string') {
      return '未知角色'
    }

    return RoleData.roleDescriptions[roleName] || '未知角色描述'
  }

  /**
   * 获取角色中文显示名称
   * @param {string} roleName - 角色名称
   * @returns {string} 角色中文名称，如果未找到则返回原始角色名
   */
  static getRoleDisplayName (roleName) {
    if (!roleName || typeof roleName !== 'string') {
      return '未知角色'
    }

    return ROLE_NAMES_CN[roleName] || roleName
  }

  /**
   * 获取所有可用角色列表
   * @returns {Array<string>} 所有角色名称数组
   */
  static getAllRoles () {
    return Object.keys(RoleData.roleWeights)
  }

  /**
   * 获取指定人数下可用的角色列表
   * @param {number} playerCount - 玩家人数
   * @returns {Array<string>} 可用角色名称数组
   */
  static getAvailableRoles (playerCount) {
    if (!Number.isInteger(playerCount) || playerCount < 6) {
      return []
    }

    return RoleData.getAllRoles().filter(
      roleName => RoleData.getUnlockCount(roleName) <= playerCount
    )
  }

  /**
   * 获取指定阵营的所有角色
   * @param {string} camp - 阵营名称 ("WOLF" | "VILLAGER" | "GOD")
   * @returns {Array<string>} 该阵营的所有角色名称
   */
  static getRolesByCamp (camp) {
    if (!camp || typeof camp !== 'string') {
      return []
    }

    return RoleData.getAllRoles().filter(
      roleName => {
        try {
          return RoleData.getCamp(roleName) === camp
        } catch (error) {
          return false
        }
      }
    )
  }

  /**
   * 判断角色是否属于特定阵营
   * @param {string} roleName - 角色名称
   * @param {string} targetCamp - 目标阵营 ("WOLF" | "GOD" | "VILLAGER")
   * @returns {boolean} 是否属于该阵营
   */
  static isCamp (roleName, targetCamp) {
    try {
      return RoleData.getCamp(roleName) === targetCamp
    } catch (error) {
      return false
    }
  }

  /**
   * 判断角色是否为狼人阵营
   * @param {string} roleName - 角色名称
   * @returns {boolean} 是否为狼人阵营
   */
  static isWolf (roleName) {
    return RoleData.isCamp(roleName, CAMPS.WOLF)
  }

  /**
   * 判断角色是否为神民
   * @param {string} roleName - 角色名称
   * @returns {boolean} 是否为神民
   */
  static isGod (roleName) {
    return RoleData.isCamp(roleName, CAMPS.GOD)
  }

  /**
   * 判断角色是否为普通村民
   * @param {string} roleName - 角色名称
   * @returns {boolean} 是否为普通村民
   */
  static isVillager (roleName) {
    return roleName === ROLES.VILLAGER
  }
}
