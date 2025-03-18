import { Role } from "./Role.js";

export class GuardRole extends Role {
  constructor(game, player) {
    super(game, player);
    this.name = "守卫";
    this.lastProtectedId = null; // 记录上一次守护的玩家ID
  }
  // 检查是否可以行动
  canAct() {
    return this.player.isAlive && this.game.currentState.getName() === "NightState";
  }

  // 获取行动提示
  async getActionPrompt(e) {
    if (!this.canAct()) return null;

    let msg = "【守卫】请选择今晚的守护目标：\n";

    // 获取存活玩家列表
    const alivePlayers = this.getAlivePlayersList();

    msg += alivePlayers;
    msg += "\n\n输入格式：#守护*号";

    // 添加上次守护信息
    if (this.lastProtectedId) {
      const lastPlayer = this.game.players.get(this.lastProtectedId);
      if (lastPlayer) {
        msg += `\n\n你上次守护的是：${lastPlayer.gameNumber}号 ${lastPlayer.name}`;
        msg += "\n注意：不能连续两晚守护同一个人";
      }
    }

    this.e.bot.sendPrivateMsg(this.player.id, msg);

    return true;
  }

  // 检查目标是否合法
  isValidTarget(target) {
    if (!target || !target.isAlive) return false;

    // 不能连续两晚守护同一个人
    if (target.id === this.lastProtectedId) {
      return false;
    }

    return true;
  }

  // 执行守护行动
  async act(target, action = "protect") {
    if (!this.isValidTarget(target)) {
        if (target && target.id === this.lastProtectedId) {
          this.e.reply("你不能连续两晚守护同一个人", true);
        } else {
          this.e.reply("无效的守护目标", true);
        }
      return false;
    }

    // 清除所有玩家的守护状态
    Array.from(this.game.players.values()).forEach(player => {
      player.protected = false;
    });

    // 设置目标玩家的守护状态
    target.protected = true;

    // 记录本次守护的玩家ID
    this.lastProtectedId = target.id;

    this.e.reply(`你成功守护了 ${target.gameNumber}号 ${target.name}`, true);

    return true;
  }
}
