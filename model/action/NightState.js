import { GameState } from "./GameState.js";
import { DayState } from "./DayState.js";

export class NightState extends GameState {
  constructor(game) {
    super(game);
    // 角色行动队列与状态控制
    this.actionQueue = ['GuardRole', 'ProphetRole', 'WolfRole', 'WitchRole']; // 角色行动顺序
    this.currentActionRole = null; // 当前行动角色
    this.actionLock = false; // 状态锁
    this.completedRoles = new Set(); // 已完成行动的角色
    this.roleActions = new Map(); // 记录各角色行动
  }

  async onEnter() { 
    await super.onEnter();
    this.roleActions.clear();
    this.completedRoles.clear();

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

  // 通知特定角色的玩家行动
  async notifyRolePlayers(roleType) {
    const playerRoles = this.game.getAlivePlayers({ roleType, includeRole: true });
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

    const role = this.game.roles.get(player.id);

    if (!this.isValidAction(player, action, role)) {
      throw new Error("非法操作");
    }

    const roleType = role.constructor.name;

    if (roleType !== this.currentActionRole) {
      throw new Error(`现在是${this.currentActionRole}的行动时间，请等待你的回合`);
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
    const result = await role.act(this.game.players.get(target), action);

    // 如果行动完成,检查是否需要进入下一阶段
    if (result) {
      const rolePlayers = this.game.getAlivePlayers({ roleType, includeRole: true });
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
  }

  // 夜晚阶段结束，处理状态转换
  async finishNightPhase() {
    // 清理保护状态
    for (const player of this.game.players.values()) {
      player.protected = false;
    }

    // 状态转换
    if (this.game.turn === 0) {
      await this.game.changeState(new DayState(this.game));
    }
  }

  // 超时处理
  async onTimeout() {
    // 处理当前行动角色
    if (this.currentActionRole) {
      // 获取未行动的玩家
      const rolePlayers = this.game.getAlivePlayers({ roleType: this.currentActionRole, includeRole: true });
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


