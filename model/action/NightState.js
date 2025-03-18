import { GameState } from "./GameState.js";
import { DayState } from "./DayState.js";
import { SheriffElectState } from "./SheriffElectState.js";
import { WolfRole } from "../roles/WolfRole.js";

export class NightState extends GameState {
  constructor(game) {
    super(game);
    this.timeLimit = game.getConfig().game.nightTimeLimit; // 夜晚时间限制
    // 角色行动队列与状态控制
    this.actionQueue = ['GuardRole', 'ProphetRole', 'WolfRole', 'WitchRole']; // 角色行动顺序
    this.currentActionRole = null; // 当前行动角色
    this.actionLock = false; // 状态锁
    this.completedRoles = new Set(); // 已完成行动的角色
    this.roleActions = new Map(); // 记录各角色行动
    // 狼人投票相关
    this.wolfVotes = new Map(); // 记录狼人投票
    this.wolfKillTarget = null; // 狼人击杀目标
  }

  async onEnter() {
    await super.onEnter();
    this.roleActions.clear();
    this.completedRoles.clear();
    this.wolfVotes.clear();
    this.wolfKillTarget = null;

    // 通知所有存活玩家夜晚开始
    const notifications = [];
    for (const player of this.game.players.values()) {
      if (player.isAlive) {
        const role = this.game.roles.get(player.id); // 提前获取角色
        notifications.push(this.notifyNightStart(player, role));
      }
    }
    await Promise.all(notifications);

    // 开始第一个角色的行动
    await this.startNextRoleAction();
  }

  // 通知玩家夜晚开始
  async notifyNightStart(player, role) {
    try {
      // 通用通知
      await this.e.bot.sendPrivateMsg(player.id, "天黑请闭眼，进入夜晚阶段");

      // 单独通知村民
      if (role?.constructor.name === "VillagerRole") {
        const prompt = role.getActionPrompt();
        await this.e.bot.sendPrivateMsg(player.id, prompt);
      }
    } catch (error) {
      console.error(`向玩家 ${player.id} 发送夜晚开始消息失败:`, error);
      this.e.reply(`无法向玩家 ${player.name} 发送私聊消息，请确认该玩家是否已添加机器人为好友`);
    }
  }

  // 开始下一个角色的行动
  async startNextRoleAction() {
    if (this.actionLock) return;

    // 所有角色行动完成，进入下一阶段
    if (this.completedRoles.size >= this.actionQueue.length || this.actionQueue.length === 0) {
      return this.finishNightPhase();
    }

    this.actionLock = true;
    this.currentActionRole = this.actionQueue.shift();

    // 通知该角色类型的所有活着的玩家
    await this.notifyRolePlayers(this.currentActionRole);
    this.actionLock = false;
  }

  // 获取当前存活的特定角色玩家及其角色对象
  getAlivePlayersWithRole(roleType) {
    return [...this.game.players.values()]
      .filter(p => {
        if (!p.isAlive) return false;
        const role = this.game.roles.get(p.id);
        return role && role.constructor.name === roleType;
      })
      .map(p => ({
        player: p,
        role: this.game.roles.get(p.id)
      }));
  }

  // 通知特定角色的玩家行动
  async notifyRolePlayers(roleType) {
    const playerRoles = this.getAlivePlayersWithRole(roleType);
    if (playerRoles.length === 0) {
      // 没有该角色的存活玩家，直接进入下一角色
      this.completedRoles.add(roleType);
      return this.startNextRoleAction();
    }

    // 发送行动通知
    for (const { player, role } of playerRoles) {
      await this.notifyPlayer(player, role);
    }
  }

  // 通知玩家夜晚行动
  async notifyPlayer(player, role) {
    if (!role) return;

    // 如果不是当前行动角色，不发送通知
    if (role.constructor.name !== this.currentActionRole) return;

    // 获取行动提示消息
    const msg = role.getActionPrompt();

    // 使用主动私聊发送消息
    try {
      await this.e.bot.sendPrivateMsg(player.id, msg);
    } catch (error) {
      console.error(`向玩家 ${player.id} 发送夜晚行动消息失败:`, error);
      // 在群内提示某玩家可能未收到消息
      this.e.reply(`无法向玩家 ${player.name} 发送私聊消息，请确认该玩家是否已添加机器人为好友`);
    }
  }

  // 处理玩家行动
  async handleAction(player, action, target) {
    if (this.actionLock) return false;

    // 获取角色对象（只获取一次）
    const role = this.game.roles.get(player.id);

    // 验证行动有效性
    if (!this.isValidAction(player, action, role)) {
      throw new Error("非法操作");
    }

    const roleType = role.constructor.name;

    // 验证是否是当前行动角色
    if (roleType !== this.currentActionRole) {
      throw new Error(`现在是${this.currentActionRole}的行动时间，请等待你的回合`);
    }

    // 特殊处理狼人投票
    if (roleType === "WolfRole" && action === "vote") {
      await this.handleWolfVote(player, target, role);
      return;
    }

    // 记录行动
    this.roleActions.set(player.id, {
      player,
      roleType,
      action,
      target,
      completed: true,
    });

    // 执行角色行动
    await role.act(this.game.players.get(target), action);

    // 检查该角色类型是否都已行动
    const rolePlayers = this.getAlivePlayersWithRole(roleType).map(pr => pr.player);
    const actedPlayers = [...this.roleActions.keys()]
      .filter(id => {
        const action = this.roleActions.get(id);
        return action && action.roleType === roleType;
      });

    if (actedPlayers.length >= rolePlayers.length) {
      this.completedRoles.add(roleType);
      await this.startNextRoleAction();
    }
  }

  // 处理狼人投票
  async handleWolfVote(player, targetId, wolfRole) {
    // 记录或更新狼人投票
    this.wolfVotes.set(player.id, {
      wolfId: player.id,
      targetId: targetId,
      timestamp: Date.now(),
    });

    // 通知其他狼人有新投票
    await this.notifyWolfVoteUpdate(player, targetId);

    // 检查是否所有狼人都已投票
    if (this.isAllWolvesVoted()) {
      // 统计投票结果
      this.wolfKillTarget = this.tallyWolfVotes();

      // 通知所有狼人最终结果
      await this.notifyWolfVoteResult();

      // 如果所有狼人都已投票，标记角色完成并进入下一阶段
      this.completedRoles.add('WolfRole');

      // 执行狼人杀人
      if (this.wolfKillTarget) {
        const target = this.game.players.get(this.wolfKillTarget);
        if (target && wolfRole) {
          await wolfRole.act(target);
        }
      }

      await this.startNextRoleAction();
    }
  }

  // 获取第一个存活特定角色的玩家角色实例
  getFirstAlivePlayerRole(roleType) {
    const players = this.getAlivePlayersWithRole(roleType);
    if (players.length === 0) return null;
    return this.game.roles.get(players[0].id);
  }

  // 通知其他狼人有新投票
  async notifyWolfVoteUpdate(voter, targetId) {
    const wolves = this.game.getAliveWolves();
    const target = this.game.players.get(targetId);
    const voterNumber = this.game.getPlayerNumber(voter.id);

    if (!target) return;

    const message = `【投票更新】狼人${voterNumber}号(${voter.name})投票击杀${target.name}`;

    // 获取当前投票状态信息
    let voteStatus = "当前投票情况：\n";
    const voteCounts = this.getWolfVoteCounts();

    for (const [targetId, count] of voteCounts.entries()) {
      const target = this.game.players.get(targetId);
      if (target) {
        voteStatus += `${target.name}: ${count}票\n`;
      }
    }

    // 添加未投票狼人信息
    const unvotedWolves = this.getUnvotedWolves();
    if (unvotedWolves.length > 0) {
      voteStatus += "\n未投票狼人：" + unvotedWolves.map((w) => w.name).join("、");
    }

    // 发送给所有存活狼人（除了投票者）
    for (const wolf of wolves) {
      if (wolf.id !== voter.id) {
        try {
          await this.e.bot.sendPrivateMsg(wolf.id, message + "\n\n" + voteStatus);
        } catch (error) {
          console.error(`向狼人 ${wolf.id} 发送投票更新失败:`, error);
        }
      }
    }
  }

  // 通知所有狼人最终投票结果
  async notifyWolfVoteResult() {
    const wolves = this.game.getAliveWolves();
    let message;

    if (this.wolfKillTarget) {
      const target = this.game.players.get(this.wolfKillTarget);
      message = `【最终结果】狼人队伍决定击杀${target.name}`;
    } else {
      message = "【最终结果】由于投票平局，今晚狼人无法达成一致，不会击杀任何人";
    }

    // 发送给所有存活狼人
    for (const wolf of wolves) {
      try {
        await this.e.bot.sendPrivateMsg(wolf.id, message);
      } catch (error) {
        console.error(`狼人 ${wolf.id} 发送最终结果失败:`, error);
      }
    }
  }

  // 获取未投票的狼人
  getUnvotedWolves() {
    const aliveWolves = this.game.getAliveWolves();
    return aliveWolves.filter((wolf) => !this.wolfVotes.has(wolf.id));
  }

  // 检查是否所有狼人都已投票
  isAllWolvesVoted() {
    const aliveWolves = this.game.getAliveWolves();
    return aliveWolves.every((wolf) => this.wolfVotes.has(wolf.id));
  }

  // 统计狼人投票结果
  getWolfVoteCounts() {
    const voteCounts = new Map();

    // 统计每个目标的票数
    for (const vote of this.wolfVotes.values()) {
      const targetId = vote.targetId;
      const currentCount = voteCounts.get(targetId) || 0;
      voteCounts.set(targetId, currentCount + 1);
    }

    return voteCounts;
  }

  // 确定最终击杀目标
  tallyWolfVotes() {
    // 如果只有一个狼人，直接采用其选择
    const aliveWolves = this.game.getAliveWolves();
    if (aliveWolves.length === 1) {
      const wolfId = aliveWolves[0].id;
      const vote = this.wolfVotes.get(wolfId);
      return vote ? vote.targetId : null;
    }

    // 统计票数
    const voteCounts = this.getWolfVoteCounts();

    // 找出最高票数
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

    // 如果有平票，返回null表示无法达成一致
    if (maxTargets.length > 1) {
      return null;
    }

    // 返回最高票数的目标
    return maxTargets[0];
  }

  // 检查行动是否有效
  isValidAction(player, action, role) {
    if (!player || !player.isAlive || !role) return false;

    const roleType = role.constructor.name;

    // 验证是否是当前行动角色
    if (roleType !== this.currentActionRole) return false;

    switch (roleType) {
      case "WolfRole":
        return ["vote", "cancelVote"].includes(action);
      case "ProphetRole":
        return action === "check";
      case "WitchRole":
        return ["save", "poison", "skip"].includes(action);
      case "GuardRole":
        return action === "protect";
      default:
        return false;
    }
  }

  // 夜晚阶段结束，处理状态转换
  async finishNightPhase() {
    // 清理保护状态
    for (const player of this.game.players.values()) {
      player.protected = false;
    }

    // 状态转换
    if (this.game.turn === 0) {
      // 如果是第一个夜晚，进入警长竞选阶段 //TODO:应该进入白天后进入警长
      this.game.changeState(new SheriffElectState(this.game));
    } else {
      // 否则进入正常的白天阶段
      this.game.changeState(new DayState(this.game));
    }
  }

  // 超时处理
  async onTimeout() {
    // 处理当前行动角色
    if (this.currentActionRole) {
      // 获取未行动的玩家
      const rolePlayers = this.getAlivePlayersWithRole(this.currentActionRole);
      const actedPlayerIds = new Set(
        [...this.roleActions.values()]
          .filter(a => a.roleType === this.currentActionRole)
          .map(a => a.player.id)
      );

      // 为未行动玩家设置默认行动
      for (const { player, role } of rolePlayers) {
        if (!actedPlayerIds.has(player.id)) {
          // 根据角色类型设置默认行动
          if (this.currentActionRole === 'WolfRole' && !this.wolfVotes.has(player.id)) {
            // 狼人默认弃权
            this.wolfVotes.set(player.id, {
              wolfId: player.id,
              targetId: null,
              timestamp: Date.now(),
            });
          } else {
            // 其他角色默认为跳过
            this.roleActions.set(player.id, {
              player,
              roleType: this.currentActionRole,
              action: 'skip',
              completed: true,
            });
          }
        }
      }

      // 标记当前角色行动完成
      this.completedRoles.add(this.currentActionRole);
    }

    // 将剩余所有角色标记为已完成
    this.actionQueue.forEach(roleType => {
      this.completedRoles.add(roleType);
    });

    // 结束夜晚阶段
    await this.finishNightPhase();
  }
}
