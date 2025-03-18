/**
 * 角色工厂类
 * 用于根据角色名称创建对应的角色实例
 */
export class RoleFactory {
  /**
   * 获取角色阵营
   * @param {string} roleName - 角色名称
   * @returns {string} 角色阵营 ("WOLF" | "VILLAGER")
   * @throws {Error} 当角色类型未知时抛出错误
   */
  static getRoleCamp(roleName) {
    switch (roleName) {
      case "WOLF": // 狼人
        return "WOLF";
      case "PROPHET": // 预言家
      case "WITCH": // 女巫
      case "HUNTER": // 猎人
      case "GUARD": // 守卫
        return "GOD";
      case "VILLAGER": // 村民
        return "VILLAGER"; // 村民
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
    // 动态导入角色类
    const { WolfRole } = await import('./WolfRole.js');
    const { VillagerRole } = await import('./VillagerRole.js');
    const { ProphetRole } = await import('./ProphetRole.js');
    const { WitchRole } = await import('./WitchRole.js');
    const { HunterRole } = await import('./HunterRole.js');
    const { GuardRole } = await import('./GuardRole.js');

    switch (roleName) {
      case "WOLF": // 狼人
        return new WolfRole(game, player);
      case "VILLAGER": // 村民
        return new VillagerRole(game, player);
      case "PROPHET": // 预言家
        return new ProphetRole(game, player);
      case "WITCH": // 女巫
        return new WitchRole(game, player);
      case "HUNTER": // 猎人
        return new HunterRole(game, player);
      case "GUARD": // 守卫
        return new GuardRole(game, player);
      default:
        throw new Error(`未知角色: ${roleName}`);
    }
  }
}
