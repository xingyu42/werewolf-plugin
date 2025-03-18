import { Role } from "./Role.js";

export class WolfRole extends Role {
  constructor(game, player) {
    super(game, player);
    this.name = "狼人";
    this.canSuicide = game.getConfig().roles.enableWolfSuicide
    this.hasVoted = false;
  }

  getCamp() {
    return "WOLF";
  }

  canAct(state) {
    return state.getName() === "NightState";
  }

  getActionPrompt() {
    const aliveWolves = this.game.getAliveWolves();
    let wolfList = "";
    if (aliveWolves.length > 0) {
      wolfList = "\n\n其他存活狼人：\n" + aliveWolves.map((w) => `${w.player.name}`).join("、");
    }

    // 获取当前投票状态
    let voteStatus = "";
    if (this.game.currentState.getName() === "NightState" && this.game.currentState.wolfVotes) {
      const voteCounts = this.game.currentState.getWolfVoteCounts();
      if (voteCounts.size > 0) {
        voteStatus = "\n\n当前投票情况：\n";
        for (const [targetId, count] of voteCounts.entries()) {
          if (targetId === null) continue; // 跳过弃权票
          const target = this.game.players.get(targetId);
          if (target) {
            voteStatus += `${target.name}: ${count}票\n`;
          }
        }
      }
    }

    return `【狼人】请选择今晚的击杀目标：
${this.getAlivePlayersList()}
输入格式：#刀*号${wolfList}${voteStatus}

你也可以与其他狼人进行队内沟通，输入格式：#讨论 你想说的话`;
  }

  // 检查目标是否合法
  isValidTarget(target) {
    if (!super.isValidTarget(target)) return false;

    // 不能杀害同伴
    if (target.id === this.player.id) return false;
    const targetRole = this.game.roles.get(target.id);
    if (targetRole.getCamp() === "WOLF") return false;

    return true;
  }

  // 狼人行动
  async act(target, action = "kill") {
    if (!target) return false;

    // 投票行为
    if (action === "vote") {
    if (!this.isValidTarget(target)) {
      throw new Error("非法目标");
    }

    // 提交投票
    await this.game.currentState.handleAction(this.player, "vote", target.id);

    // 给投票者一个确认
    this.e.reply(`你已投票击杀${target.name}`);

    return true;
    }

    // 直接杀人行为
    if (action === "kill") {
      // 检查目标是否被守卫保护
      if (target.protected) {
        this.e.reply(`${target.name}被守卫保护，无法击杀`);
        return false;
      }

      // 设置目标死亡
      await this.game.handlePlayerDeath(target, 'WOLF_KILL');
      return true;
    }

    return false;
  }

  // 狼人自爆 //TODO: 当前自爆逻辑和狼人杀规则冲突
  async suicide() {
    if (!this.canSuicide) {
      throw new Error("当前游戏不允许狼人自爆");
    }

    // 自爆会立即死亡
    this.player.isAlive = false;

    // 通知所有玩家
    this.e.reply(`${this.player.name}选择自爆,身份是狼人`);

    // 跳过当前阶段
    this.game.currentState.onTimeout();
  }

  // 狼人队内沟通
  async discuss(message) {
    // 检查当前是否为夜晚阶段
    if (this.game.currentState.getName() !== "NightState") {
      throw new Error("只有在夜晚阶段才能使用狼人队内沟通");
    }

    // 获取其他存活的狼人
    const wolves = this.game.getAliveWolves();
    if (wolves.length === 0) {
      throw new Error("没有其他存活的狼人可以沟通");
    }

    // 构建消息前缀，包含狼人编号和名称
    const playerNumber = this.game.getPlayerNumber(this.player.id);
    const prefix = `[狼人${playerNumber}号-${this.player.name}]：`;

    // 添加时间戳
    const now = new Date();
    const timestamp = `[${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}]`;

    // 完整消息
    const fullMessage = `${timestamp} \n${prefix}${message}`;

    // 转发消息给其他狼人
    for (const wolf of wolves) {
      await this.e.bot.sendPrivateMsg(wolf.player.id, fullMessage);
    }

    // 给发送者一个确认
    this.e.reply("消息已发送给其他狼人");

    return true;
  }
}
