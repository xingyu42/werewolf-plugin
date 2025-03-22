import { Role } from "./Role.js";

export class WolfRole extends Role {
  static wolfVotes = new Map(); // 静态属性存储所有狼人投票
  static wolfKillTarget = null; // 最终击杀目标
  
  constructor(game, player) {
    super(game, player);
    this.name = "狼人";
    this.canSuicide = game.getConfig().roles.enableWolfSuicide;
  }

  getCamp() {
    return "WOLF";
  }

  canAct(state) {
    return state.getName() === "NightState";
  }

  getActionPrompt() {
    const aliveWolves = this.game.getAlivePlayers({ roleType: "WolfRole", includeRole: true });
    let wolfList = "";
    if (aliveWolves.length > 0) {
      wolfList = "\n\n其他存活狼人：\n" + aliveWolves.map((w) => `${w.player.name}`).join("、");
    }

    // 获取当前投票状态
    let voteStatus = "";
    if (this.game.currentState.getName() === "NightState") {
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

  // 处理狼人投票
  async handleVote(targetId) {
    // 记录投票 (targetId 为 null 时表示弃权)
    WolfRole.wolfVotes.set(this.player.id, {
      wolfId: this.player.id,
      targetId: targetId,
      timestamp: Date.now()
    });

    // 通知其他狼人
    await this.notifyVoteUpdate(targetId);

    // 检查是否所有狼人都已投票
    if (this.isAllWolvesVoted()) {
      // 确定最终目标
      WolfRole.wolfKillTarget = this.tallyVotes();
      
      // 通知结果
      await this.notifyVoteResult();

      // 执行击杀(如果有目标)
      if (WolfRole.wolfKillTarget) {
        const target = this.game.players.get(WolfRole.wolfKillTarget);
        if (target) {
          await this.act(target, "kill");
        }
      }

      return true;
    }

    return false;
  }

  // 通知其他狼人新投票
  async notifyVoteUpdate(targetId) {
    const wolves = this.game.getAlivePlayers({ roleType: "WolfRole", includeRole: true });
    const voterNumber = this.game.getPlayerNumber(this.player.id);

    let voteMsg;
    if (targetId === null) {
      voteMsg = `【投票更新】狼人${voterNumber}号(${this.player.name})选择弃权`;
    } else {
      const target = this.game.players.get(targetId);
      voteMsg = `【投票更新】狼人${voterNumber}号(${this.player.name})投票击杀${target.name}`;
    }

    let voteStatus = "\n当前投票情况：\n";
    
    // 获取投票统计
    const voteCounts = this.getVoteCounts();
    for (const [tId, count] of voteCounts.entries()) {
      if (tId === null) {
        voteStatus += `弃权: ${count}票\n`;
      } else {
        const target = this.game.players.get(tId);
        if (target) {
          voteStatus += `${target.name}: ${count}票\n`;
        }
      }
    }

    // 添加未投票狼人
    const unvotedWolves = this.getUnvotedWolves();
    if (unvotedWolves.length > 0) {
      voteStatus += "\n未投票狼人：" + unvotedWolves.map(w => w.name).join("、");
    }

    // 通知其他狼人
    for (const wolf of wolves) {
      if (wolf.id !== this.player.id) {
        await this.e.bot.sendPrivateMsg(wolf.id, voteMsg + "\n" + voteStatus);
      }
    }
  }

  // 通知投票结果
  async notifyVoteResult() {
    const wolves = this.game.getAlivePlayers({ roleType: "WolfRole", includeRole: true });
    let message;

    if (!WolfRole.wolfKillTarget) {
      // 区分是否因为全部弃权
      const allSkipped = [...WolfRole.wolfVotes.values()].every(v => v.targetId === null);
      message = allSkipped 
        ? "【最终结果】所有狼人选择弃权，今晚不会击杀任何人"
        : "【最终结果】由于投票平局，今晚狼人无法达成一致，不会击杀任何人";
    } else {
      const target = this.game.players.get(WolfRole.wolfKillTarget);
      message = `【最终结果】狼人队伍决定击杀${target.name}`;
    }

    for (const wolf of wolves) {
      await this.e.bot.sendPrivateMsg(wolf.id, message);
    }
  }

  // 获取投票统计
  getVoteCounts() {
    const voteCounts = new Map();
    for (const vote of WolfRole.wolfVotes.values()) {
      const targetId = vote.targetId;
      voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1);
    }
    return voteCounts;
  }

  // 统计最终结果
  tallyVotes() {
    const aliveWolves = this.game.getAlivePlayers({ roleType: "WolfRole", includeRole: true });
    
    // 单狼直接返回
    if (aliveWolves.length === 1) {
      const vote = WolfRole.wolfVotes.get(aliveWolves[0].id);
      return vote ? vote.targetId : null;
    }

    // 统计票数
    const voteCounts = this.getVoteCounts();
    let maxVotes = 0;
    let maxTargets = [];

    for (const [targetId, count] of voteCounts.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        maxTargets = [targetId];
      } else if (count === maxVotes) {
        maxTargets.push(targetId);
      }
    }

    return maxTargets.length === 1 ? maxTargets[0] : null;
  }

  // 检查是否所有狼人已投票
  isAllWolvesVoted() {
    const aliveWolves = this.game.getAlivePlayers({ roleType: "WolfRole", includeRole: true });
    return aliveWolves.every(wolf => WolfRole.wolfVotes.has(wolf.id));
  }

  // 获取未投票狼人
  getUnvotedWolves() {
    const aliveWolves = this.game.getAlivePlayers({ roleType: "WolfRole", includeRole: true });
    return aliveWolves.filter(wolf => !WolfRole.wolfVotes.has(wolf.id));
  }

  // 重写act方法
  async act(target, action = "kill") {
    if (action === "vote") {
      // 空刀逻辑
      if (!target) {
        const result = await this.handleVote(null);
        await this.e.reply("你选择了放弃击杀");
        return result;
      }
      
      // 正常投票逻辑
      if (!this.isValidTarget(target)) {
        throw new Error("非法目标");
      }
      const result = await this.handleVote(target.id);
      await this.e.reply(`你已投票击杀${target.name}`);
      return result;
    }

    if (action === "kill") {
      if (!target) return true; // 空刀直接返回成功
      if (target.protected) {
        await this.e.reply(`${target.name}被守卫保护，无法击杀`);
        return false;
      }
      await this.game.handlePlayerDeath(target, 'WOLF_KILL');
      return true;
    }

    return false;
  }

  // 狼人自爆
  async suicide() {
    if (!this.canSuicide) {
      throw new Error("当前游戏不允许狼人自爆");
    }

    // 自爆会立即死亡
    this.player.isAlive = false;

    // 通知所有玩家
    await this.e.reply(`${this.player.name}选择自爆,身份是狼人`);

    // 跳过当前阶段
    await this.game.currentState.onTimeout();
  }

  // 狼人队内沟通
  async discuss(message) {
    // 检查当前是否为夜晚阶段
    if (this.game.currentState.getName() !== "NightState") {
      throw new Error("只有在夜晚阶段才能使用狼人队内沟通");
    }

    // 获取其他存活的狼人
    const wolves = this.game.getAlivePlayers({ roleType: "WolfRole", includeRole: true });
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
    await this.e.reply("消息已发送给其他狼人");

    return true;
  }
}



