import { Role } from "./Role.js";

export class ProphetRole extends Role {
  constructor(game, player) {
    super(game, player);
    this.checkHistory = new Map(); // 查验历史记录
  }

  canAct(state) {
    return state.getName() === "NightState";
  }

  getActionPrompt() {
    let historyInfo = "";
    if (this.checkHistory.size > 0) {
      historyInfo =
        "\n\n已查验玩家：\n" +
        Array.from(this.checkHistory.entries())
          .map(([id, { result }]) => {
            const player = this.game.players.get(id);
            return `${player.name}：${result}`;
          })
          .join("\n");
    }

    return `【预言家】请选择今晚的查验目标：\n ${this.getAlivePlayersList()} \n 输入格式：#查验*号 \n ${historyInfo}`;
  }

  // 检查目标是否合法
  isValidTarget(target) {
    if (!super.isValidTarget(target)) return false;

    // 不能查验自己
    if (target.id === this.player.id) return false;

    return true;
  }

  // 预言家查验
  async act(target, action = "check") {
    if (!target) return false;

    if (!this.isValidTarget(target)) {
      this.e.reply("非法目标");
      return false;
    }

    let result;
    const timestamp = Date.now();
    const targetRole = this.game.roles.get(target.id);

    // 查验阵营
    const isGood = await targetRole.getCamp() !== "WOLF";
    result = `${target.name}是${isGood ? "好人" : "狼人"}`;

    // 记录查验结果
    this.checkHistory.set(target.id, {
      result,
      timestamp,
      turn: this.game.turn,
    });

    // 发送查验结果
    this.e.reply(`${result} (查验时间: 第${this.game.turn}天 ${new Date(timestamp).toLocaleTimeString()})`);

    return result;
  }

  // 获取查验历史
  getCheckHistory(targetId) {
    return this.checkHistory.get(targetId);
  }

  // 验证查验记录
  verifyCheckRecord(targetId, record) {
    const storedRecord = this.checkHistory.get(targetId);
    if (!storedRecord) return false;
    return storedRecord.timestamp === record.timestamp && storedRecord.turn === record.turn;
  }
}
