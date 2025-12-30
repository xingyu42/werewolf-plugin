import { ActionHandler } from '../model/cqrs/ActionHandler.js'
import { ACTIONS } from '../model/core/Constants.js'

export class GameRoles extends plugin {
  constructor () {
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
          reg: '^#空刀$',
          fnc: 'wolfSkip'
        }
      ]
    })
  }

  // 守卫守护
  async guardAction (e) {
    if (e.isGroup) {
      e.reply('请私聊发送命令')
      return false
    }
    await ActionHandler.handle(e, {
      role: 'GuardRole',
      target: { required: true, parse: (msg) => msg.match(/(\\d+)/)?.[1] },
      action: async ({ role, targetPlayer, currentState }) => {
        if (!role.canAct(currentState)) throw new Error('当前阶段不能执行此操作')
        await role.act(targetPlayer)
        await currentState.handleAction(role.player, ACTIONS.PROTECT, targetPlayer.id)
      }
    })
  }

  // 猎人射杀
  async hunterShoot (e) {
    await ActionHandler.handle(e, {
      role: 'HunterRole',
      target: { required: true, parse: (msg) => msg.match(/(\\d+)/)?.[1] },
      action: async ({ role, targetPlayer }) => {
        if (!role.canAct()) throw new Error('你当前无法开枪')
        await role.act(targetPlayer)
      }
    })
  }

  // 预言家查验
  async prophetCheck (e) {
    if (e.isGroup) {
      e.reply('请私聊发送命令')
      return false
    }
    await ActionHandler.handle(e, {
      role: 'ProphetRole',
      target: { required: true, parse: (msg) => msg.match(/(\\d+)/)?.[1] },
      action: async ({ role, targetPlayer, currentState }) => {
        if (!role.canAct(currentState)) throw new Error('当前阶段不能执行此操作')
        await role.act(targetPlayer)
        await currentState.handleAction(role.player, ACTIONS.CHECK, targetPlayer.id)
      }
    })
  }

  // 女巫毒人
  async witchPoison (e) {
    if (e.isGroup) {
      e.reply('请私聊发送命令')
      return false
    }
    await ActionHandler.handle(e, {
      role: 'WitchRole',
      target: { required: true, parse: (msg) => msg.match(/(\\d+)/)?.[1] },
      action: async ({ role, targetPlayer, currentState }) => {
        if (!role.canAct(currentState)) throw new Error('当前阶段不能执行此操作')
        await role.act(targetPlayer, 'poison')
        await currentState.handleAction(role.player, ACTIONS.POISON, targetPlayer.id)
      }
    })
  }

  // 女巫救人
  async witchSave (e) {
    if (e.isGroup) {
      e.reply('请私聊发送命令')
      return false
    }
    await ActionHandler.handle(e, {
      role: 'WitchRole',
      action: async ({ role, currentState }) => {
        if (!role.canAct(currentState)) throw new Error('当前阶段不能执行此操作')
        await role.act(null, 'save')
        await currentState.handleAction(role.player, ACTIONS.SAVE)
      }
    })
  }

  // 狼人杀人
  async wolfKill (e) {
    if (e.isGroup) {
      e.reply('请私聊发送命令')
      return false
    }
    await ActionHandler.handle(e, {
      role: 'WolfRole',
      target: { required: true, parse: (msg) => msg.match(/(\\d+)/)?.[1] },
      action: async ({ role, targetPlayer, currentState }) => {
        if (!role.canAct(currentState)) throw new Error('当前阶段不能执行此操作')
        await currentState.handleAction(role.player, ACTIONS.KILL, targetPlayer.id)
      }
    })
  }

  // 女巫放弃用药
  async witchSkip (e) {
    if (e.isGroup) {
      e.reply('请私聊发送命令')
      return false
    }
    await ActionHandler.handle(e, {
      role: 'WitchRole',
      action: async ({ role, currentState }) => {
        if (!role.canAct(currentState)) throw new Error('当前阶段不能执行此操作')
        await currentState.handleAction(role.player, ACTIONS.SKIP)
      }
    })
  }

  async wolfSkip (e) {
    if (e.isGroup) {
      e.reply('请私聊发送命令')
      return false
    }
    await ActionHandler.handle(e, {
      role: 'WolfRole',
      action: async ({ role, currentState }) => {
        if (!role.canAct(currentState)) throw new Error('当前阶段不能执行此操作')
        await currentState.handleAction(role.player, ACTIONS.SKIP)
      }
    })
  }
}
