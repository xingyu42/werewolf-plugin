import { ROLES, CAMPS } from '../core/Constants.js';
/**
 * 角色工厂类
 * 用于根据角色名称创建对应的角色实例
 */
export class RoleFactory {
  // 角色模块缓存
  static roleModules = null;
  
  /**
   * 预加载所有角色模块
   * @returns {Promise<void>}
   */
  static async preloadRoleModules() {
    if (RoleFactory.roleModules !== null) {
      return; // 已经预加载过，直接返回
    }
    
    // 初始化角色模块缓存
    RoleFactory.roleModules = {};
    
    // 并行加载所有角色模块
    const loadPromises = [
      import('./WolfRole.js').then(module => RoleFactory.roleModules.WolfRole = module.WolfRole),
      import('./VillagerRole.js').then(module => RoleFactory.roleModules.VillagerRole = module.VillagerRole),
      import('./ProphetRole.js').then(module => RoleFactory.roleModules.ProphetRole = module.ProphetRole),
      import('./WitchRole.js').then(module => RoleFactory.roleModules.WitchRole = module.WitchRole),
      import('./HunterRole.js').then(module => RoleFactory.roleModules.HunterRole = module.HunterRole),
      import('./GuardRole.js').then(module => RoleFactory.roleModules.GuardRole = module.GuardRole)
    ];
    
    // 等待所有模块加载完成
    await Promise.all(loadPromises);
    
    console.log('所有角色模块预加载完成');
  }

  /**
   * 获取角色阵营
   * @param {string} roleName - 角色名称
   * @returns {string} 角色阵营 ("WOLF" | "VILLAGER")
   * @throws {Error} 当角色类型未知时抛出错误
   */
  static getRoleCamp(roleName) {
    switch (roleName) {
      case ROLES.WOLF: // 狼人
        return CAMPS.WOLF;
      case ROLES.PROPHET: // 预言家
      case ROLES.WITCH: // 女巫
      case ROLES.HUNTER: // 猎人
      case ROLES.GUARD: // 守卫
        return CAMPS.GOD;
      case ROLES.VILLAGER: // 村民
        return CAMPS.VILLAGER; // 村民
      default:
        throw new Error(`未知的角色类型: ${roleName}`);
    }
  }

  /**
   * 创建角色实例
   * @param {string} roleName - 角色名称
   * @param {Game} game - 游戏实例
   * @param {Player} player - 玩家实例
   * @returns {Role} 对应的角色实例
   * @throws {Error} 当角色类型未知时抛出错误
   */
  static async createRole(roleName, game, player) {
    // 如果角色模块尚未预加载，则进行预加载
    if (RoleFactory.roleModules === null) {
      await RoleFactory.preloadRoleModules();
    }
    
    switch (roleName) {
      case ROLES.WOLF: // 狼人
        return new RoleFactory.roleModules.WolfRole(game, player);
      case ROLES.VILLAGER: // 村民
        return new RoleFactory.roleModules.VillagerRole(game, player);
      case ROLES.PROPHET: // 预言家
        return new RoleFactory.roleModules.ProphetRole(game, player);
      case ROLES.WITCH: // 女巫
        return new RoleFactory.roleModules.WitchRole(game, player);
      case ROLES.HUNTER: // 猎人
        return new RoleFactory.roleModules.HunterRole(game, player);
      case ROLES.GUARD: // 守卫
        return new RoleFactory.roleModules.GuardRole(game, player);
      default:
        throw new Error(`未知角色: ${roleName}`);
    }
  }
}
