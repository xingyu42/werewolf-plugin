import { GameState } from "./GameState.js";

export class SheriffTransferState extends GameState {
  constructor(game, sheriff, nextState) {
    super(game);
    this.timeLimit = 30; // 移交时间限制
    this.sheriff = sheriff; // 当前警长
    this.nextState = nextState; // 下一个状态
    this.hasTransferred = false; // 是否已移交
    this.transferTarget = null; // 移交目标
  }

  async onEnter() {
    await super.onEnter();

    // 获取可选继承人列表
    const candidates = [...this.game.players.values()].filter((p) => p.isAlive && p.id !== this.sheriff.id);

    // 通知警长选择继承人
    this.e.reply(`\n=== 警长移交 ===\n` + `警长 ${this.sheriff.name} 请在 ${this.timeLimit} 秒内选择移交警徽的对象"#警长移交*号"\n` + `输入"跳过"可以放弃移交\n` + "可选玩家:\n" + candidates.map((p) => `${p.id}: ${p.name}`).join("\n") + "\n==================");
  }

  // 处理玩家行为
  async handleAction(player, action, targetId) {
    if (!this.isValidAction(player, action)) {
      throw new Error("非法操作");
    }

    if (action === "transfer") {
      await this.handleTransfer(player, targetId);
    } else if (action === "skip") {
      await this.handleSkip(player);
    } else {
      throw new Error(`未知操作: ${action}`);
    }
  }

  // 获取非法操作的原因
  getInvalidActionReason(playerId, action) {
    if (playerId !== this.sheriff.id) {
      return "只有警长可以移交警徽";
    }
    if (this.hasTransferred) {
      return "警徽已经移交";
    }
    if (action !== "transfer" && action !== "skip") {
      return "无效的操作类型";
    }
    return "未知原因";
  }

  // 检查行动是否有效
  isValidAction(player, action) {
    if (player !== this.sheriff) return false;
    if (this.hasTransferred) return false;

    return action === "transfer" || action === "skip";
  }

  // 处理移交
  async handleTransfer(player, targetId) {
    try {
      const target = this.game.players.get(targetId);
      if (!target) {
        throw new Error("目标玩家不存在");
      }

      if (!target.isAlive) {
        throw new Error("不能将警徽移交给死亡玩家");
      }

      if (target.id === this.sheriff.id) {
        throw new Error("不能将警徽移交给自己");
      }

      this.hasTransferred = true;
      this.transferTarget = target;
      this.sheriff.isSheriff = false;
      target.isSheriff = true;

      this.e.reply(`\n=== 警长移交结果 ===\n` + `原警长: ${this.sheriff.name}\n` + `新警长: ${target.name}\n` + "====================");

      // 进入下一个状态
      await this.game.changeState(this.nextState);
    } catch (err) {
      console.error("警长移交失败:", err);
      throw err;
    }
  }

  // 处理放弃移交
  async handleSkip(player) {
    try {
      this.hasTransferred = true;
      this.e.reply(`\n=== 警长移交结果 ===\n` + `警长 ${this.sheriff.name} 选择带走警徽\n` + "====================");

      // 进入下一个状态
      await this.game.changeState(this.nextState);
    } catch (err) {
      console.error("处理放弃移交时出错:", err);
      this.hasTransferred = false;
      throw err;
    }
  }

  // 超时处理
  async onTimeout() {
    try {
      if (!this.hasTransferred) {
        this.e.reply(`\n=== 警长移交结果 ===\n` + `警长 ${this.sheriff.name} 超时未移交,警徽将被带走\n` + "====================");

        // 进入下一个状态
        await this.game.changeState(this.nextState);
      }
    } catch (err) {
      console.error("处理警长移交超时时出错:", err);
      // 强制进入下一个状态
      await this.game.changeState(this.nextState);
    }
  }

  async onExit() {
    await super.onExit();
    // 清理状态
    this.hasTransferred = false;
    this.transferTarget = null;
    this.sheriff = null;
  }
}
