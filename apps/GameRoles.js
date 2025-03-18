import { GameManager } from "../model/GameManager.js";
import { HunterRole } from "../model/roles/HunterRole.js";

export class GameRoles extends plugin {
  constructor() {
    super({
      name: '狼人杀角色行动',
      dsc: '处理狼人杀游戏中的角色行动',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#守护\\d+号$',
          fnc: 'guardAction'
        },
        {
          reg: '^#反杀\\d+号$',
          fnc: 'hunterShoot'
        },
        {
          reg: '^#查验\\d+号$',
          fnc: 'prophetCheck'
        },
        {
          reg: '^#毒杀\\d+号$',
          fnc: 'witchPoison'
        },
        {
          reg: '^#救人$',
          fnc: 'witchSave'
        },
        {
          reg: '^#放弃$',
          fnc: 'witchSkip'
        },
        {
          reg: '^#刀\\d+号$',
          fnc: 'wolfKill'
        },
        {
          reg: '^#自爆$',
          fnc: 'wolfSuicide'
        } //TODO:增加狼人空刀
      ]
    });
  }

  getGame(e) {
    let game = GameManager.getGame(e.group_id);
    if (!game) {
      e.reply('当前群没有进行中的游戏');
      return false;
    }
    return game;
  }

  // 验证角色行动
  validateAction(game, e, roleType) {
    // 检查发送消息的玩家是否在游戏中
    const player = game.getPlayerById(e.user_id);

    if (!player) {
      throw new Error('你不是游戏中的玩家');
    }

    // 获取玩家角色实例
    const role = game.roles.get(player.id);

    if (!role) {
      throw new Error('未找到角色信息');
    }

    // 检查角色类型
    if (role.getName() !== roleType) {
      throw new Error(`你不是${roleType}，无法执行此操作`);
    }

    // 检查当前游戏状态是否允许该角色行动
    const currentState = game.getCurrentState();
    if (!role.canAct(currentState)) {
      throw new Error('当前阶段不能执行此操作');
    }

    // 检查是否是当前行动角色的回合
    if (currentState.currentActionRole !== roleType) {
      throw new Error(`现在是${currentState.currentActionRole}的行动时间，请等待你的回合`);
    }

    return role;
  }

  // 守卫守护
  async guardAction(e) {
    try {
      let game = this.getGame(e);
      if (!game) return false;

      // 从消息中提取目标号码
      const gameNumber = e.msg.match(/^#守护(\d+)号$/)[1];

      // 验证守卫角色
      const role = this.validateAction(game, e, "GuardRole");

      // 根据游戏内编号获取目标玩家
      const target = game.getPlayerByNumber(gameNumber);
      if (!target) {
        e.reply("目标玩家不存在");
        return true;
      }

      // 执行守护行动
      await role.act(target);

      // 通知游戏状态该行动已完成
      await currentState.handleAction(role.player, "protect", target.id);

      return true;
    } catch (error) {
      e.reply(`操作失败: ${error.message}`);
      return true;
    }
  }

  // 猎人射杀
  async hunterShoot(e) {
    let game = this.getGame(e);
    if (!game) return false;

      // 从消息中提取目标号码
      const gameNumber = e.msg.match(/^#反杀(\d+)号$/)[1];

      // 获取玩家
      const player = game.getPlayerById(e.user_id);
      if (!player) {
        e.reply("你不是游戏中的玩家");
        return true;
      }

      // 获取猎人角色
      const role = game.roles.get(player.id);
      if (!role || !(role instanceof HunterRole)) {
        e.reply("你不是猎人，无法执行此操作");
        return true;
      }

      // 检查是否可以开枪
      if (!role.canAct()) {
        e.reply("你当前无法开枪");
        return true;
      }

      // 根据游戏内编号获取目标玩家
      const target = game.getPlayerByNumber(gameNumber);
      if (!target) {
        e.reply("目标玩家不存在");
        return true;
      }

      // 执行射杀行动
      await role.act(target);
      return true;
    } catch (error) {
      e.reply(`操作失败: ${error.message}`);
      return true;
    }


  // 预言家查验
  async prophetCheck(e) {
    if (e.isGroup) {
      e.reply('请私聊发送命令');
      return false;
    }
    try {
      let game = this.getGame(e);
      if (!game) return false;

      // 从消息中提取目标号码
      const gameNumber = e.msg.match(/^#查验(\d+)号$/)[1];

      // 验证预言家角色
      const role = this.validateAction(game, e, "ProphetRole");

      // 根据游戏内编号获取目标玩家
      const target = game.getPlayerByNumber(gameNumber);
      if (!target) {
        e.reply("目标玩家不存在");
        return true;
      }

      // 执行查验行动
      const result = await role.act(target);

      // 通知游戏状态该行动已完成
      const currentState = game.getCurrentState();
      await currentState.handleAction(role.player, "check", target.id);

      return true;
    } catch (error) {
      e.reply(`操作失败: ${error.message}`);
      return true;
    }
  }

  // 女巫毒人
  async witchPoison(e) {
    try {
      let game = this.getGame(e);
      if (!game) return false;

      // 从消息中提取目标号码
      const gameNumber = e.msg.match(/^#毒杀(\d+)号$/)[1];

      // 验证女巫角色
      const role = this.validateAction(game, e, "WitchRole");

      // 根据游戏内编号获取目标玩家
      const target = game.getPlayerByNumber(gameNumber);
      if (!target) {
        e.reply("目标玩家不存在");
        return true;
      }

      // 执行毒杀行动
      await role.act(target, "poison");

      // 通知游戏状态该行动已完成
      const currentState = game.getCurrentState();
      await currentState.handleAction(role.player, "poison", target.id);

      return true;
    } catch (error) {
      e.reply(`操作失败: ${error.message}`);
      return true;
    }
  }

  // 女巫救人
  async witchSave(e) {
    try {
      let game = this.getGame(e);
      if (!game) return false;

      // 验证女巫角色
      const role = this.validateAction(game, e, "WitchRole");

      // 获取当前被狼人杀的玩家
      const currentState = game.getCurrentState();
      if (!currentState.wolfKillTarget) {
        e.reply("当前没有可以救的人");
        return true;
      }

      const target = game.players.get(currentState.wolfKillTarget);
      if (!target) {
        e.reply("目标玩家不存在");
        return true;
      }

      // 执行救人行动
      await role.act(target, "save");

      // 通知游戏状态该行动已完成
      await currentState.handleAction(role.player, "save", target.id);

      return true;
    } catch (error) {
      e.reply(`操作失败: ${error.message}`);
      return true;
    }
  }

  // 狼人杀人
  async wolfKill(e) {
    try {
      let game = this.getGame(e);
      if (!game) return false;

      // 从消息中提取目标号码
      const gameNumber = e.msg.match(/^#刀(\d+)号$/)[1];

      // 验证狼人角色
      const role = this.validateAction(game, e, "WolfRole");

      // 根据游戏内编号获取目标玩家
      const target = game.getPlayerByNumber(gameNumber);
      if (!target) {
        e.reply("目标玩家不存在");
        return true;
      }
      // 执行投票行动
      await role.act(target, "vote");
      return true;
    } catch (error) {
      e.reply(`操作失败: ${error.message}`);
      return true;
    }
  }

  // 狼人自爆
  async wolfSuicide(e) {
    try {
      let game = this.getGame(e);
      if (!game) return false;

      // 验证狼人角色
      const role = this.validateAction(game, e, "WolfRole");

      // 执行自爆行动
      await role.suicide();
      return true;
    } catch (error) {
      e.reply(`操作失败: ${error.message}`);
      return true;
    }
  }

  // 女巫放弃用药
  async witchSkip(e) {
    try {
      let game = this.getGame(e);
      if (!game) return false;

      // 验证女巫角色
      const role = this.validateAction(game, e, "WitchRole");

      // 执行放弃行动
      await role.act(null, "skip");

      // 通知游戏状态该行动已完成
      const currentState = game.getCurrentState();
      await currentState.handleAction(role.player, "skip", null);

      return true;
    } catch (error) {
      e.reply(`操作失败: ${error.message}`);
      return true;
    }
  }
}
