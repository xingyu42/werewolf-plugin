import { GameState } from "./GameState.js";
import { HunterRole } from "../roles/HunterRole.js";

export class LastWordsState extends GameState {
  constructor(game, nextState, deadPlayer) {
    super(game);
    this.deadPlayer = deadPlayer; // 死亡玩家
    this.nextState = nextState; // 下一个状态
    this.timeLimit = game.getConfig().game.lastWordsTimeLimit // 遗言时间限制
    this.speechTimeout = null; // 发言计时器
  }

  async onEnter() {
    await super.onEnter();

    // 显示遗言提示
    this.e.reply(`\n=== ${this.deadPlayer.name}的遗言时间 ===\n` +
      `剩余时间: ${this.timeLimit}秒\n` +
      '输入"#跳过"可以放弃遗言', true, { at: true });

    // 设置遗言计时器
    this.speechTimeout = setTimeout(async () => {
      try {
        await this.onTimeout();
      } catch (err) {
        console.error("遗言超时处理失败:", err);
      }
    }, this.timeLimit * 1000);
  }

  async onExit() {
    await super.onExit();

    // 清除计时器
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }

    // 检查死亡玩家是否是猎人且可以开枪
    const deadRole = this.game.roles.get(this.deadPlayer.id);
    if (deadRole instanceof HunterRole && deadRole.canAct()) {
      // 遗言结束后触发猎人开枪
      this.e.reply(`猎人 ${this.deadPlayer.name} 的遗言结束，现在可以开枪`);
      await deadRole.getActionPrompt();
    } else {
      // 非猎人或猎人无法开枪，直接进入下一状态
      await this.game.changeState(this.nextState);
    }
  }

  // 处理玩家行为
  async handleAction(player, action, message) {
    if (!this.isValidAction(player, action)) {
      const reason = this.getInvalidActionReason(player, action);
      throw new Error(reason);
    }

    if (action === "skip") {
      await this.handleSkip(player);
    } else {
      throw new Error(`未知操作: ${action}`);
    }
  }

  // 获取非法操作的原因
  getInvalidActionReason(player, action) {
    if (player.id !== this.deadPlayer.id) {
      return "只有死亡玩家可以跳过遗言";
    }
    if (this.hasSpoken) {
      return "已经发表过遗言";
    }
    if (action !== "skip") {
      return "无效的操作类型";
    }
    return "未知原因";
  }


  // 处理跳过
  async handleSkip(player) {
    try {
      // 清除计时器
      if (this.speechTimeout) {
        clearTimeout(this.speechTimeout);
        this.speechTimeout = null;
      }

      this.hasSpoken = true;

      this.e.reply(`${player.name}放弃了遗言`);

      // 进入下一个状态
      await this.game.changeState(this.nextState);
    } catch (err) {
      console.error("处理跳过遗言时出错:", err);
      this.hasSpoken = false;
      throw err;
    }
  }

  // 检查行动是否有效
  isValidAction(player, action) {
    if (player.id !== this.deadPlayer.id) return false;
    if (this.hasSpoken) return false;

    return action === "speak" || action === "skip";
  }

  // 结束遗言
  async onTimeout() {
    try {
      if (!this.hasSpoken) {
        this.hasSpoken = true;
        this.e.reply(`\n=== ${this.deadPlayer.name}的遗言结束 ===\n`);

        // 进入下一个状态
        await this.game.changeState(this.nextState);
      }
    } catch (err) {
      console.error("结束遗言出错:", err);
      // 强制进入下一个状态
      await this.game.changeState(this.nextState);
    }
  }
}
