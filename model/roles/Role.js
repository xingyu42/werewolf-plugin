export class Role {
  constructor(game, player) {
    this.game = game;
    this.player = player;
  }

  // 获取角色名称
  getName() {
    return this.player.role;
  }

  /**
   * 获取角色阵营
   * @returns {string} 角色阵营
   */
  async getCamp() {
    const { RoleFactory } = await import('./RoleFactory.js');
    return RoleFactory.getRoleCamp(this.player.role);
  }

  // 检查是否可以在当前阶段行动
  canAct(state) {
    return false;
  }

  // 执行行动
  async act(target) {
    throw new Error("需要在子类中实现act方法");
  }

  // 获取行动提示
  getActionPrompt() {
    return "";
  }

  // 验证目标是否合法
  isValidTarget(target) {
    if (!target) return false;
    return target.isAlive;
  }
    // 获取存活玩家列表
  getAlivePlayersList() {
    return Array.from(this.game.players.values())
      .filter((player) => player.isAlive)
      .map((player) => `${player.gameNumber}号 ${player.name}`)
      .join("\n");
  }

}
