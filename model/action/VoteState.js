import { GameState } from "./GameState.js";
import { NightState } from "./NightState.js";
import { LastWordsState } from "./LastWordsState.js";
export class VoteState extends GameState {
  constructor(game) {
    super(game);
    this.timeLimit = game.getConfig().game.voteTimeLimit // 投票时间限制
    this.votes = new Map(); // 记录投票情况
    this.votedPlayers = new Set(); // 已经投票的玩家
    this.hunterShootTimeout = null; // 猎人开枪超时计时器
  }

  async onEnter() {
    await super.onEnter();
    this.votes.clear();
    this.votedPlayers.clear(); // 清空已投票玩家

    // 通知所有存活玩家开始投票
    this.e.reply("开始投票,请存活的玩家#投票*号");

    // 显示可投票的玩家列表
    const playerList = [...this.game.players.values()]
      .filter((p) => p.isAlive)
      .map((p, i) => `${i}:${p.name}`)
      .join("\n");

    this.e.reply(playerList);

    // 设置投票时间限制
    this.voteTimeout = setTimeout(async () => {
      await this.onTimeout(); // 超时处理
    }, this.timeLimit * 1000); // 将秒转换为毫秒
  }

  // 处理投票
  async handleAction(player, action, targetId) {
    if (!this.isValidAction(player, action, targetId)) {
      throw new Error("非法操作");
    }

    // 记录投票
    this.votes.set(player.id, targetId);
    this.votedPlayers.add(player.id); // 添加到已投票玩家集合

    // 通知投票成功
    this.e.reply(`${player.name}完成投票`);

    // 检查是否所有人都投票完成
    if (this.isAllVoted()) {
      await this.resolveVotes();
    }
  }

  // 检查行动是否有效
  isValidAction(player, action, targetId) {
    if (!player || !player.isAlive) return false;
    if (action !== "vote") return false;
    if (this.votes.has(player.id)) return false; // 已经投过票

    // 验证目标是否有效
    const target = this.game.players.get(targetId);
    if (!target || !target.isAlive) return false;

    return true;
  }

  // 检查是否所有人都投票了
  isAllVoted() {
    const alivePlayers = [...this.game.players.values()].filter((p) => p.isAlive);
    return this.votedPlayers.size >= alivePlayers.length;
  }

  // 统计投票结果
  tallyVotes() {
    const results = {};
    this.votes.forEach((targetId) => {
      results[targetId] = (results[targetId] || 0) + 1;
    });
    return results;
  }

  // 清空投票记录
  resetVotes() {
    this.votes.clear();
    this.votedPlayers.clear();
  }

  // 处理投票结果
  async resolveVotes() {
    // 统计票数
    const voteCount = this.tallyVotes();

    // 找出最高票数的玩家
    let maxVotes = 0;
    let votedPlayers = [];
    for (const [targetId, count] of Object.entries(voteCount)) {
      if (count > maxVotes) {
        maxVotes = count;
        votedPlayers = [targetId];
      } else if (count === maxVotes) {
        votedPlayers.push(targetId);
      }
    }

    // 检查是否达到最低票数要求
    const minVotes = this.game.getConfig().game.minVotesToKill // 最少投票数
    if (maxVotes <= minVotes) {
      this.e.reply("没有玩家得票数超过最低要求,无人出局");
      this.game.changeState(new NightState(this.game));
      return;
    }

    // 如果有平票,则无人出局
    if (votedPlayers.length > 1) {
      this.e.reply("出现平票,无人出局");
      this.game.changeState(new NightState(this.game));
      return;
    }

    // 处理出局玩家
    const votedId = votedPlayers[0];
    const votedPlayer = this.game.players.get(votedId);

    // 设置死亡原因为放逐
    votedPlayer.deathReason = 'EXILE';

    // 检查是否是猎人
    const votedRole = this.game.roles.get(votedId);

    // 先处理玩家死亡
    votedPlayer.isAlive = false;
    this.e.reply(`${votedPlayer.name}被投票放逐出局`);

    // 创建下一个状态（夜晚）
    const nextState = new NightState(this.game);

    // 进入遗言阶段，并传入下一个状态
    await this.game.changeState(new LastWordsState(this.game, nextState, votedPlayer));
  }

  // 超时处理
  async onTimeout() {
    clearTimeout(this.voteTimeout); // 清除定时器
    await this.resolveVotes();
  }
}
