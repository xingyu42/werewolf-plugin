import { GameManager } from "../model/GameManager.js";
import { VoteState } from "../model/action/VoteState.js"; // 引入 VoteState
import { LastWordsState } from "../model/action/LastWordsState.js"; // 引入 LastWordsState
import { SheriffElectState } from "../model/action/SheriffElectState.js"; // 引入 SheriffElectState
import { SheriffTransferState } from "../model/action/SheriffTransferState.js"; // 引入 SheriffTransferState
import { WolfRole } from "../model/roles/WolfRole.js"; // 引入 WolfRole

export class GameAction extends plugin {
  constructor() {
    super({
      name: "狼人杀行动阶段",
      dsc: "狼人杀行动阶段",
      event: "message",
      priority: 5,
      rule: [
        { reg: "^#投票(\\d+)号$", fnc: "handleVote" },
        { reg: "^#结束遗言$", fnc: "handleSkip" },
        { reg: "^#竞选警长$", fnc: "handleSheriffElect" },
        { reg: "^#警长移交(\\d+)号$", fnc: "handleSheriffTransfer" },
        { reg: "^#放弃移交$", fnc: "handleGiveupTransfer" },
        { reg: "^#支持(\\d+)号$", fnc: "handleSupport" },
        { reg: "^#讨论(.*)$", fnc: "wolfDiscuss" },
        { reg: "^#结束发言$", fnc: "handleEndSpeech" },
      ],
    });
  }

  /**
   * 获取当前群的游戏实例
   * @param {object} e 消息事件对象
   * @returns {Game|false} 游戏实例或 false
   */
  getGame(e) {
    // 获取游戏实例
    const gameInstance = GameManager.getGame(e.group_id);
    // 游戏实例检查
    if (!gameInstance) {
      e.reply("当前群没有进行中的游戏");
      return false;
    }
    return gameInstance;
  }

  // 处理投票
  async handleVote(e) {
    const game = this.getGame(e);
    if (!game) return false;

    try {
      const targetId = e.msg.match(/(\d+)号/)?.[1];
      if (!targetId) {
        e.reply("请指定正确的玩家编号");
        return false;
      }

      const player = game.getPlayerById(e.user_id);
      if (!player) {
        e.reply("您不是游戏参与者");
        return false;
      }

      if (!player.isAlive) {
        e.reply("死亡玩家无法投票");
        return false;
      }

      const voteState = new VoteState(game);
      await voteState.handleAction(player, "vote", targetId);
      return true;
    } catch (err) {
      console.error('[狼人杀] 投票处理错误:', err);
      e.reply("投票过程出现错误，请重试");
      return false;
    }
  }

  // 处理结束遗言
  async handleSkip(e) {
    const game = this.getGame(e);
    if (!game) return false;

    try {
      const player = game.getPlayerById(e.user_id);
      if (!player) {
        e.reply("您不是游戏参与者");
        return false;
      }

      const currentState = game.getCurrentState();
      if (!(currentState instanceof LastWordsState)) {
        e.reply("当前不是遗言阶段，无法结束遗言");
        return false;
      }

      await currentState.handleAction(player, "skip");
      return true;
    } catch (err) {
      console.error('[狼人杀] 结束遗言处理错误:', err);
      e.reply("处理结束遗言操作时出现错误");
      return false;
    }
  }

  // 处理竞选警长
  async handleSheriffElect(e) {
    const game = this.getGame(e);
    if (!game) return false;

    try {
      const player = game.getPlayerById(e.user_id);
      if (!player) {
        e.reply("您不是游戏参与者");
        return false;
      }

      if (!player.isAlive) {
        e.reply("死亡玩家无法竞选警长");
        return false;
      }

      const currentState = game.getCurrentState();
      if (!(currentState instanceof SheriffElectState)) {
        e.reply("当前不是警长竞选阶段");
        return false;
      }

      await currentState.handleAction(player, "register");
      return true;
    } catch (err) {
      console.error('[狼人杀] 警长竞选错误:', err);
      e.reply("警长竞选过程出现错误");
      return false;
    }
  }

  // 处理警长移交
  async handleSheriffTransfer(e) {
    const game = this.getGame(e);
    if (!game) return false;

    try {
      const targetId = e.msg.match(/(\d+)号/)?.[1];
      if (!targetId) {
        e.reply("请指定正确的玩家编号");
        return false;
      }

      const player = game.getPlayerById(e.user_id);
      if (!player) {
        e.reply("您不是游戏参与者");
        return false;
      }

      if (!player.isSheriff) {
        e.reply("只有警长可以移交警徽");
        return false;
      }

      const currentState = game.getCurrentState();
      if (!(currentState instanceof SheriffTransferState)) {
        e.reply("当前不是警长移交阶段");
        return false;
      }

      await currentState.handleAction(player, "transfer", targetId);
      return true;
    } catch (err) {
      console.error('[狼人杀] 警长移交错误:', err);
      e.reply("警长移交过程出现错误");
      return false;
    }
  }

  // 处理放弃移交
  async handleGiveupTransfer(e) {
    const game = this.getGame(e);
    if (!game) return false;

    try {
      const player = game.getPlayerById(e.user_id);
      if (!player) {
        e.reply("您不是游戏参与者");
        return false;
      }

      if (!player.isSheriff) {
        e.reply("只有警长可以选择放弃移交");
        return false;
      }

      const currentState = game.getCurrentState();
      if (!(currentState instanceof SheriffTransferState)) {
        e.reply("当前不是警长移交阶段");
        return false;
      }

      await currentState.handleAction(player, "giveup");
      return true;
    } catch (err) {
      console.error('[狼人杀] 放弃移交错误:', err);
      e.reply("处理放弃移交时出现错误");
      return false;
    }
  }

  // 处理支持
  async handleSupport(e) {
    const game = this.getGame(e);
    if (!game) return false;

    try {
      const targetId = e.msg.match(/(\d+)号/)?.[1];
      if (!targetId) {
        e.reply("请指定正确的玩家编号");
        return false;
      }

      const player = game.getPlayerById(e.user_id);
      if (!player) {
        e.reply("您不是游戏参与者");
        return false;
      }

      if (!player.isAlive) {
        e.reply("死亡玩家无法投票支持");
        return false;
      }

      const currentState = game.getCurrentState();
      if (!(currentState instanceof SheriffElectState)) {
        e.reply("当前不是警长竞选阶段");
        return false;
      }

      await currentState.handleAction(player, "support", targetId);
      return true;
    } catch (err) {
      console.error('[狼人杀] 支持投票错误:', err);
      e.reply("支持投票过程出现错误");
      return false;
    }
  }

  // 狼人讨论
  async wolfDiscuss(e) {
    const game = this.getGame(e);
    if (!game) return false;
    if (e.isGroup) return false;

    try {
      const player = game.getPlayerById(e.user_id);
      if (!player) {
        e.reply("您不是游戏参与者");
        return false;
      }

      if (!player.isAlive) {
        e.reply("死亡玩家无法参与讨论");
        return false;
      }

      const role = game.roles.get(player.id);
      if (!(role instanceof WolfRole)) {
        e.reply("只有狼人可以使用狼人讨论");
        return false;
      }

      const content = e.msg.match(/^#讨论(.*)$/)?.[1]?.trim();
      if (!content) {
        e.reply("请输入讨论内容");
        return false;
      }

      // 向所有狼人发送讨论内容
      const wolves = game.getAlivePlayers({ roleType: "WolfRole", includeRole: true });
      wolves.filter(wolf => wolf.id !== player.id)
      for (const wolf of wolves) {
        if (wolf.id !== player.id) {
          await this.e.bot.sendPrivateMsg(wolf.id, `${player.name}：${content}`);
        }
      }

      e.reply("已发送讨论内容给其他狼人");
      return true;
    } catch (err) {
      console.error('[狼人杀] 狼人讨论错误:', err);
      e.reply("处理狼人讨论时出现错误");
      return false;
    }
  }

  // 处理结束发言
  async handleEndSpeech(e) {
    const game = this.getGame(e);
    if (!game) return false;

    try {
      const player = game.getPlayerById(e.user_id);
      if (!player) {
        e.reply("您不是游戏参与者");
        return false;
      }

      if (!player.isAlive) {
        e.reply("死亡玩家无法结束发言");
        return false;
      }

      const currentState = game.getCurrentState();
      if (!(currentState.getName() === "DayState")) {
        e.reply("当前不是白天发言阶段");
        return false;
      }

      const result = await currentState.handleEndSpeech(player);
      return result;
    } catch (err) {
      console.error('[狼人杀] 结束发言错误:', err);
      e.reply("处理结束发言操作时出现错误");
      return false;
    }
  }
}
