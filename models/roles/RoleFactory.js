/**
 * @file RoleFactory.js
 * @description 角色工厂类，根据角色名称创建对应的角色实例
 * @module model/strategies/roles/RoleFactory
 *
 * @input ROLES, CAMPS, WolfRole, VillagerRole, ProphetRole, WitchRole, HunterRole, GuardRole
 * @output RoleFactory - 角色工厂类
 * @pos 策略层 - 角色实例化工厂
 *
 * @dependencies
 * - ../../core/Constants.js - 角色和阵营常量
 * - ./WolfRole.js - 狼人角色
 * - ./VillagerRole.js - 村民角色
 * - ./ProphetRole.js - 预言家角色
 * - ./WitchRole.js - 女巫角色
 * - ./HunterRole.js - 猎人角色
 * - ./GuardRole.js - 守卫角色
 */
import { ROLES, CAMPS } from '../Constants.js'
import { WolfRole } from './WolfRole.js'
import { VillagerRole } from './VillagerRole.js'
import { ProphetRole } from './ProphetRole.js'
import { WitchRole } from './WitchRole.js'
import { HunterRole } from './HunterRole.js'
import { GuardRole } from './GuardRole.js'

/**
 * 角色工厂类
 * 用于根据角色名称创建对应的角色实例
 */
export class RoleFactory {
  // 角色模块缓存
  static roleModules = {
    WolfRole,
    VillagerRole,
    ProphetRole,
    WitchRole,
    HunterRole,
    GuardRole
  }

  /**
   * 预加载所有角色模块
   * @returns {Promise<void>}
   */
  static async preloadRoleModules () {
    // 使用静态导入，无需预加载
    console.log('所有角色模块已通过静态导入加载完成')
  }

  /**
   * 获取角色阵营
   * @param {string} roleName - 角色名称
   * @returns {string} 角色阵营 ("WOLF" | "VILLAGER")
   * @throws {Error} 当角色类型未知时抛出错误
   */
  static getRoleCamp (roleName) {
    switch (roleName) {
      case ROLES.WOLF: // 狼人
        return CAMPS.WOLF
      case ROLES.PROPHET: // 预言家
      case ROLES.WITCH: // 女巫
      case ROLES.HUNTER: // 猎人
      case ROLES.GUARD: // 守卫
        return CAMPS.GOD
      case ROLES.VILLAGER: // 村民
        return CAMPS.VILLAGER // 村民
      default:
        throw new Error(`未知的角色类型: ${roleName}`)
    }
  }

  /**
   * 创建角色实例
   * @param {string} roleName - 角色名称
   * @param {Game} game - 游戏实例
   * @param {Player} player - 玩家实例
   * @param {Object} e - 通信对象，用于消息发送
   * @returns {Role} 对应的角色实例
   * @throws {Error} 当角色类型未知时抛出错误
   */
  static createRole (roleName, game, player, e) {
    // 参数验证
    if (!roleName || typeof roleName !== 'string') {
      throw new Error('角色名称必须是非空字符串')
    }

    if (!game) {
      throw new Error('游戏实例不能为空')
    }

    if (!player) {
      throw new Error('玩家实例不能为空')
    }

    if (!e) {
      throw new Error('通信对象不能为空')
    }

    if (!e.reply || typeof e.reply !== 'function') {
      throw new Error('通信对象必须包含reply方法')
    }

    if (!e.bot || !e.bot.pickFriend || typeof e.bot.pickFriend !== 'function') {
      throw new Error('通信对象必须包含bot.pickFriend方法')
    }

    switch (roleName) {
      case ROLES.WOLF: // 狼人
        return new RoleFactory.roleModules.WolfRole(game, player, e)
      case ROLES.VILLAGER: // 村民
        return new RoleFactory.roleModules.VillagerRole(game, player, e)
      case ROLES.PROPHET: // 预言家
        return new RoleFactory.roleModules.ProphetRole(game, player, e)
      case ROLES.WITCH: // 女巫
        return new RoleFactory.roleModules.WitchRole(game, player, e)
      case ROLES.HUNTER: // 猎人
        return new RoleFactory.roleModules.HunterRole(game, player, e)
      case ROLES.GUARD: // 守卫
        return new RoleFactory.roleModules.GuardRole(game, player, e)
      default:
        throw new Error(`未知角色: ${roleName}`)
    }
  }
}
