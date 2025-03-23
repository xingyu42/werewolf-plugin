import { GameState } from "./GameState.js";
import { VoteState } from "./VoteState.js";
import { LastWordsState } from "./LastWordsState.js";
import { HunterRole } from "../roles/HunterRole.js";

export class DayState extends GameState {
  constructor(game) {
    super(game);
    this.speakTimeLimit = game.getConfig().game.speakTimeLimit; // 发言时间限制
    this.currentSpeakerIndex = 0;
    this.speakOrder = [];
  }

  async onEnter() {
    await super.onEnter();
    await this.announceDeaths();
    await this.initializeSpeakOrder();
    await this.startDiscussion();
  }

  // 通知死亡信息
  async announceDeaths() {
    // 获取夜间死亡的玩家
    const deadPlayers = [...this.game.players.values()]
      .filter(p => !p.isAlive && (p.deathReason === 'WOLF_KILL' || p.deathReason === 'POISON'));

    if (deadPlayers.length === 0) {
      this.e.reply("昨晚是平安夜，没有玩家死亡");
      return;
    }

    // 构建死亡信息
    let deathMsg = "昨晚死亡的玩家:\n";
    for (const player of deadPlayers) {
      deathMsg += `${player.name}\n`;
    }

    this.e.reply(deathMsg);

    // 处理头夜死亡玩家的遗言
    if (this.game.turn === 0 && deadPlayers.length > 0) {
      await this.game.changeState(new LastWordsState(this.game, this, deadPlayers[0]));
      return;
    }

    // 首夜过后检查死亡玩家中特殊角色
    for (const player of deadPlayers) {
      const role = this.game.roles.get(player.id);
      if (role instanceof HunterRole && role.canAct()) {
        this.e.reply(`猎人 ${player.name} 死亡，现在可以开枪`);
        await role.getActionPrompt();
        return;
      }
      if (player.isSheriff) {
        this.e.reply(`警长 ${player.name} 死亡，现在可以转移警长`);
        await this.game.changeState(new SheriffTransferState(this.game, player, this));
        return;
      }
    }

    // 如果是第一个夜晚，进入警长竞选阶段
    if (this.game.turn === 0 && this.game.getConfig().game.sheriff) {
      this.game.changeState(new SheriffElectState(this.game));
    }
  }

  // 初始化发言顺序
  async initializeSpeakOrder() {
    // 获取所有存活玩家
    const alivePlayers = this.game.getAlivePlayers();
    
    // 如果有警长，从警长开始
    if (this.game.sheriff) {
      const sheriffIndex = alivePlayers.findIndex(p => p.id === this.game.sheriff.id);
      if (sheriffIndex !== -1) {
        // 重排序数组，使警长在第一位
        this.speakOrder = [
          ...alivePlayers.slice(sheriffIndex),
          ...alivePlayers.slice(0, sheriffIndex)
        ];
      }
    } else {
      // 没有警长就按游戏号码顺序
      this.speakOrder = [...alivePlayers].sort((a, b) => a.gameNumber - b.gameNumber);
    }
  }

  // 开始讨论
  async startDiscussion() {
    await this.e.reply("白天阶段开始，按顺序发言");
    await this.nextSpeaker();
  }

  // 处理下一个发言者
  async nextSpeaker() {
    if (this.currentSpeakerIndex >= this.speakOrder.length) {
      // 所有人都发言完毕
      await this.e.reply("所有玩家已完成发言");
      await this.onTimeout();
      return;
    }

    const currentPlayer = this.speakOrder[this.currentSpeakerIndex];
    const nextPlayer = this.speakOrder[this.currentSpeakerIndex + 1];

    // 通知当前发言者
    await this.e.reply([
      segment.at(currentPlayer.id),
      `轮到你发言了，请在${this.speakTimeLimit}秒内完成发言\n发言完毕请输入 #结束发言\n`,
      nextPlayer ? `\n下一位发言者: ${nextPlayer.name}` : "\n你是最后一位发言者"
    ]);

    // 设置发言超时
    this.speakTimeout = setTimeout(() => {
      this.handleSpeakTimeout(currentPlayer);
    }, this.speakTimeLimit * 1000);
  }

  // 处理发言超时
  async handleSpeakTimeout(player) {
    await this.e.reply([
      segment.at(player.id),
      "发言时间已到，将自动进入下一位发言"
    ]);
    this.currentSpeakerIndex++;
    await this.nextSpeaker();
  }

  // 处理结束发言
  async handleEndSpeech(player) {
    // 清除发言计时器
    if (this.speakTimeout) {
      clearTimeout(this.speakTimeout);
      this.speakTimeout = null;
    }

    // 检查是否当前发言者
    if (this.currentSpeakerIndex < this.speakOrder.length && 
        this.speakOrder[this.currentSpeakerIndex].id === player.id) {
      
      await this.e.reply(`${player.name} 结束发言`);
      
      // 进入下一位发言者
      this.currentSpeakerIndex++;
      await this.nextSpeaker();
      return true;
    } else {
      await this.e.reply(`${player.name} 现在不是你的发言时间`);
      return false;
    }
  }

  async onTimeout() {
    await this.e.reply("发言时间结束，进入投票阶段");
    await this.game.changeState(new VoteState(this.game));
  }
}

