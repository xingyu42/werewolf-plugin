import { GameState } from "./GameState.js";
import { VoteState } from "./VoteState.js";
import { LastWordsState } from "./LastWordsState.js";
import { HunterRole } from "../roles/HunterRole.js";
//TODO: 修改自由讨论,根据顺序at几号玩家发言
export class DayState extends GameState {
  constructor(game) {
    super(game);
    this.timeLimit = game.getConfig().game.discussionTimeLimit // 讨论时间
  }

  async onEnter() {
    await super.onEnter(); // 调用父类方法

    // 通知所有玩家死亡信息
    await this.announceDeaths();

    // 开始自由讨论
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

    // 首夜过后检查死亡玩家中是否有猎人，如果有且可以开枪，则触发猎人反杀
    for (const player of deadPlayers) {
      const role = this.game.roles.get(player.id);
      if (role instanceof HunterRole && role.canAct()) {
        this.e.reply(`猎人 ${player.name} 死亡，现在可以开枪`);
        await role.getActionPrompt();
        // 只处理第一个可以开枪的猎人
        return;
      }
    }
  }

  // 开始自由讨论
  async startDiscussion() {
    const minutes = Math.floor(this.timeLimit / 60);
    const seconds = this.timeLimit % 60;
    const timeText = `${minutes}分${seconds > 0 ? seconds + "秒" : ""}`;

    this.e.reply(`白天自由讨论开始，时间为${timeText}，所有存活的玩家可以自由发言`);

    // 设置定时提醒
    this.setupTimeReminders();
  }

  // 设置定时提醒
  setupTimeReminders() {
    // 如果讨论时间超过1分钟，在剩余1分钟时提醒
    if (this.timeLimit > 60) {
      setTimeout(() => {
        this.e.reply("讨论还剩1分钟").catch(console.error);
      }, (this.timeLimit - 60) * 1000);
    }

    // 如果讨论时间超过30秒，在剩余30秒时提醒
    if (this.timeLimit > 30) {
      setTimeout(() => {
        this.e.reply("讨论还剩30秒").catch(console.error);
      }, (this.timeLimit - 30) * 1000);
    }
  }

  // 超时处理
  async onTimeout() {
    this.e.reply("讨论时间结束，进入投票阶段");
    // 直接进入投票阶段
    this.game.changeState(new VoteState(this.game));
  }
}
