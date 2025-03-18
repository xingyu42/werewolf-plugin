import { GameState } from "./GameState.js";
import { DayState } from "./DayState.js";

export class SheriffElectState extends GameState {
  constructor(game) {
    super(game);
    this.timeLimit = game.getConfig().game.sheriffElectTimeLimit // 竞选时间
    this.SPEECH_TIME = game.getConfig().game.sheriffSpeechTime // 每人发言时间（秒）
    this.phase = "REGISTER"; // 阶段：REGISTER(报名), SPEECH(发言), VOTE(投票)
    this.candidates = []; // 候选人
    this.votes = new Map(); // 投票记录
    this.votedPlayers = new Set(); // 已投票玩家
  }

  // 进入竞选阶段
  async onEnter() {
    await super.onEnter();

    // 通知开始警长竞选
    this.e.reply('开始竞选警长环节,想要竞选警长的玩家请发言"#竞选警长"');
  }

  async onExit() {
    await super.onExit();

    // 清除所有计时器
    if (this._registerTimer) {
      clearTimeout(this._registerTimer);
      this._registerTimer = null;
    }
    // 清除发言计时器
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
  }

  // 处理玩家行为
  async handleAction(player, action, data) {
    if (!this.isValidAction(player, action)) {
      throw new Error("非法操作");
    }

    switch (action) {
      // 竞选登记
      case "register":
        await this.handleRegister(player);
        break;
      // 投票
      case "vote":
        await this.handleVote(player, data);
        break;
      default:
        throw new Error(`未知操作: ${action}`);
    }
  }

  // 处理竞选登记
  async handleRegister(player) {
    this.candidates.push(player.id);

    await this.e.reply(`${player.name}参与警长竞选`);

    // 使用状态锁防止竞态条件
    if (this._registerTimer) {
      clearTimeout(this._registerTimer);
    }
    // 竞选计时器
    this._registerTimer = setTimeout(async () => {
      try {
        if (this.phase === "REGISTER" && !this._phaseChanging) {
          this._phaseChanging = true;
          await this.startSpeechPhase();
          this._phaseChanging = false;
        }
      } catch (err) {
        console.error("切换发言阶段失败:", err);
        this._phaseChanging = false;
      }
    }, 3000);
  }

  // 开始发言阶段
  async startSpeechPhase() {
    this.phase = "SPEECH";

    if (this.candidates.length === 0) {
      // 无人竞选,直接进入白天
      await this.e.reply("无人竞选警长,直接进入白天");
      this.game.changeState(new DayState(this.game));
      return;
    }

    // 随机决定发言顺序
    const candidateList = [...this.candidates];
    this.speakOrder = this.game.shuffle(candidateList);

    // 发送发言阶段开始通知
    this.e.reply(`竞选者发言阶段开始，每人有${this.SPEECH_TIME}秒发言时间，时间到将自动轮到下一位`);

    // 开始第一位发言者
    await this.startNextSpeaker(0);
  }

  // 开始下一位发言者
  async startNextSpeaker(index) {
    // 清除之前的计时器
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }

    // 检查是否所有人都发言完毕
    if (index >= this.speakOrder.length) {
      // 所有人发言完毕，进入投票阶段
      await this.startVotePhase();
      return;
    }

    // 设置当前发言者
    this.currentSpeaker = this.speakOrder[index];
    const speaker = this.game.players.get(this.currentSpeaker);

    // 使用引用回复和@功能提醒当前发言者
    this.e.reply(`请${speaker.name}开始发言，您有${this.SPEECH_TIME}秒时间`, true, { at: true });

    // 设置计时器，时间到后自动切换到下一位
    this.speechTimeout = setTimeout(async () => {
      try {
        // 如果玩家未发言，记录为超时未发言
        if (!this.speechRecords.has(this.currentSpeaker)) {
          this.speechRecords.set(this.currentSpeaker, "(超时未发言)");
          this.e.reply(`${speaker.name}超时未发言`, true);
        }

        // 进入下一位发言
        await this.startNextSpeaker(index + 1);
      } catch (err) {
        console.error("切换发言者失败:", err);
      }
    }, this.SPEECH_TIME * 1000);
  }

  // 开始投票阶段
  async startVotePhase() {
    this.phase = "VOTE";

    // 清除发言计时器
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }

    // 开始投票
    this.e.reply("所有竞选者发言完毕,开始投票\n" + "请存活的玩家投票选出警长(输入#投票*号)");

    // 显示候选人列表
    const candidateList = [...this.candidates]
      .map((id) => {
        const player = this.game.players.get(id);
        return `${id}: ${player.name}`;
      })
      .join("\n");

    this.e.reply(candidateList);
  }

  // 处理投票
  async handleVote(player, targetId) {
    if (!this.candidates.includes(targetId)) {
      throw new Error("投票目标必须是候选人");
    }

    this.votes.set(player.id, targetId);

    this.e.reply(`${player.name}完成投票`);

    // 检查是否所有人都投票完成
    if (this.isAllVoted()) {
      await this.resolveVotes();
    }
  }

  // 检查是否所有人都投票了
  isAllVoted() {
    const aliveCount = [...this.game.players.values()].filter((p) => p.isAlive).length;

    return this.votes.size >= aliveCount;
  }

  // 处理投票结果
  async resolveVotes() {
    // 统计票数
    const voteCount = new Map();
    for (const targetId of this.votes.values()) {
      const count = voteCount.get(targetId) || 0;
      voteCount.set(targetId, count + 1);
    }

    // 找出得票最多的玩家
    let maxVotes = 0;
    let sheriffCandidates = [];
    for (const [targetId, count] of voteCount.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        sheriffCandidates = [targetId];
      } else if (count === maxVotes) {
        sheriffCandidates.push(targetId);
      }
    }

    if (sheriffCandidates.length > 1) {
      // 平票,无人当选
      this.e.reply("警长竞选出现平票,无人当选");
    } else {
      // 产生新警长
      const sheriffId = sheriffCandidates[0];
      const sheriff = this.game.players.get(sheriffId);
      sheriff.isSheriff = true;

      this.e.reply(`${sheriff.name}当选为新警长`);
    }

    // 进入白天
    this.game.changeState(new DayState(this.game));
  }

  // 检查行动是否有效
  isValidAction(player, action) {
    if (!player || !player.isAlive) return false;

    switch (this.phase) {
      case "REGISTER":
        // 在注册阶段，只允许未注册的玩家进行注册操作
        return action === "register" && !this.candidates.includes(player.id);

      case "VOTE":
        // 在投票阶段，只允许未投票的玩家进行投票操作
        return action === "vote" && !this.votes.has(player.id);

      default:
        // 其他阶段或未知阶段，不允许任何操作
        return false;
    }
  }

  // 超时处理
  // 超时处理方法，根据当前阶段执行不同的操作
  async onTimeout() {
    switch (this.phase) {
      case "REGISTER":
        // 注册阶段超时，自动进入发言阶段
        await this.startSpeechPhase();
        break;

      case "VOTE":
        // 投票阶段超时，自动结算投票结果
        await this.resolveVotes();
        break;
    }
  }
}
