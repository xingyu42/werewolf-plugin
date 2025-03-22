import { Role } from "./Role.js";
import { HunterRole } from "./HunterRole.js";

export class WitchRole extends Role {
  constructor(game, player) {
    super(game, player);
    this.name = "女巫";
    this.canSaveSelf = game.getConfig().roles.witchCanSaveSelf // 女巫是否能自救
    this.hasAntidote = true; // 拥有解药
    this.hasPoison = true; // 拥有毒药
  }

  canAct(state) {
    return state.getName() === "NightState"
  }

  getActionPrompt() {

    if (!this.hasAntidote && !this.hasPoison) {
      return "【女巫】你已经没有药可以使用了";
    }

    let prompt = "【女巫】请选择要使用的药水,不能同时使用解药和毒药：\n";

    // 如果有解药且今晚有人被狼人杀害
    if (this.hasAntidote) {
      const state = this.game.currentState;
      const wolfAction = state.actions.get("WOLF");
      if (wolfAction) {
        const victim = this.game.players.get(wolfAction.target);
        prompt += `1. 今晚 ${victim.name} 被狼人杀害\n   使用解药救人：#救人\n`;
      }
    }

    // 如果有毒药
    if (this.hasPoison) {
      prompt += `${this.hasAntidote ? "2" : "1"}. 使用毒药毒人：\n${this.getAlivePlayersList()}\n   输入格式：#毒杀*号\n`;
    }
    prompt += "\n放弃请输入：#放弃";
    this.e.bot.sendPrivateMsg(this.player.id, prompt);

    return true
  }

  // 检查目标是否合法
  isValidTarget(target, action) {
    if (!target) return false;

    if (action === "save") {
      // 检查是否还有解药
      if (!this.hasAntidote) return false;

      // 检查目标是否是被狼人杀死的人
      return target.deathReason === 'WOLF_KILL';
    } else if (action === "poison") {
      // 检查是否还有毒药
      if (!this.hasPoison) return false;

      // 检查目标是否存活
      return target.isAlive;
    }

    return false;
  }

  // 女巫用药
  async act(target, action) {
    if (!target) {
      if (action === "skip") {
        await this.e.reply(`${this.player.name}选择不使用任何药水`);
        return true;
      }
      return false;
    }

    if (!this.isValidTarget(target, action)) {
      await this.e.reply("非法目标");
      return false;
    }

    if (action === "save") {
      // 检查是否能自救
      if (target.id === this.player.id && !this.canSaveSelf) {
        await this.e.reply("你不能对自己使用解药");
        return false;
      }

      // 使用解药
      this.hasAntidote = false;
      target.isAlive = true;
      target.deathReason = null;
      await this.e.reply(`${this.player.name}使用解药救活了${target.name}`);
      return true;
    } else if (action === "poison") {
      // 使用毒药
      this.hasPoison = false;
      await this.game.handlePlayerDeath(target, 'POISON');
      await this.e.reply(`${this.player.name}使用毒药毒死了${target.name}`);
      return true;
    }

    return false;
  }

  // 跳过使用药水
  async skip(e) {
    await this.e.reply(`${this.player.name}选择不使用任何药水`);
    return true;
  }
}
