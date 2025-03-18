import { Role } from "./Role.js";

export class HunterRole extends Role {
  constructor(game, player) {
    super(game, player);
    this.canShoot = true; // 是否可以开枪
    this.name = "猎人"; // 添加角色名称
  }

  // 获取角色名称
  getName() {
    return this.name;
  }

  // 猎人可以在死亡时开枪，但需要根据死亡原因判断
  canAct() {
    // 猎人必须已死亡且有开枪权限
    if (!this.canShoot || this.player.isAlive) return false
    // 根据死亡原因判断
    switch (this.player.deathReason) {
      case 'WOLF_KILL': // 被狼人杀死
      case 'EXILE':     // 被放逐
        return true;
      case 'POISON':    // 被毒杀
        return false;
      default:
        return false;
    }
  }

  // 获取行动提示
  async getActionPrompt() {
    if (!this.canAct()) return true

    let msg = "【猎人】你已死亡，请开枪射向其他玩家.\n";

    // 获取存活玩家列表
    const playersList = this.getAlivePlayersList();

    msg += playersList;
    msg += "\n\n输入：#反杀*号";

    this.e.reply(msg)
    return true
  }

  // 处理目标ID
  processTargetId(targetId) {
    if (!targetId || typeof targetId !== "string") {
      throw new Error("无效的目标ID格式");
    }

    // 移除可能的"号"字符
    targetId = targetId.replace(/号$/, "");

    // 检查是否为数字
    if (!/^\d+$/.test(targetId)) {
      throw new Error("目标ID必须为数字");
    }

    return targetId;
  }

  // 检查目标是否合法
  isValidTarget(rawTargetId) {
    if (!this.canAct()) {
      throw new Error("当前无法开枪");
    }

    const targetId = this.processTargetId(rawTargetId);

    // 检查目标是否存在
    const target = this.game.players.get(targetId);
    if (!target) {
      throw new Error("目标玩家不存在");
    }

    // 不能射杀自己
    if (targetId === this.player.id) {
      throw new Error("不能射杀自己");
    }

    return true;
  }

  // 猎人开枪
  async act(rawTargetId) {
    try {
      const targetId = this.processTargetId(rawTargetId);

      if (!this.isValidTarget(targetId)) {
        return false;
      }

      const target = this.game.players.get(targetId);

      // 使用开枪能力
      this.canShoot = false;

      // 射杀目标
      target.isAlive = false;
      target.deathReason = 'HUNTER_SHOT'; // 设置死亡原因为猎人射杀

      // 调用玩家死亡处理方法
      await this.game.handlePlayerDeath(target);

      // 发送消息
      this.e.reply(`猎人 ${this.player.name} 开枪射杀了 ${target.name}(${target.id}号)`, true);

      return true;
    } catch (err) {
      console.error("猎人开枪失败:", err);
      this.e.reply(`开枪失败: ${err.message}`, false, { user_id: this.player.id });
      return false;
    }
  }
}
