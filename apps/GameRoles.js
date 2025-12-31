/**
 * @file GameRoles.js
 * @description 角色技能应用，处理各角色夜晚技能命令
 * @module apps/GameRoles
 *
 * @input ActionController
 * @output GameRoles - 继承 plugin 的应用类
 * @pos 路由层 - 角色技能命令
 *
 * @dependencies
 * - ../controllers/ActionController.js - 行动控制器
 */
import { ActionController } from '../controllers/ActionController.js'

export class GameRoles extends plugin {
  constructor () {
    super({
      name: '狼人杀角色行动',
      dsc: '狼人杀角色行动',
      event: 'message',
      priority: 5,
      rule: [
        { reg: '^#守护(\\d+)号$', fnc: 'guard' },
        { reg: '^#查验(\\d+)号$', fnc: 'check' },
        { reg: '^#毒杀(\\d+)号$', fnc: 'poison' },
        { reg: '^#救人$', fnc: 'save' },
        { reg: '^#空过$', fnc: 'skip' },
        { reg: '^#刀(\\d+)号$', fnc: 'kill' },
        { reg: '^#开枪(\\d+)号$', fnc: 'shoot' }
      ]
    })
  }

  async guard (e) { return ActionController.roleAction(e, 'guard') }
  async check (e) { return ActionController.roleAction(e, 'check') }
  async poison (e) { return ActionController.roleAction(e, 'poison') }
  async save (e) { return ActionController.roleAction(e, 'save') }
  async skip (e) { return ActionController.roleAction(e, 'skip') }
  async kill (e) { return ActionController.roleAction(e, 'kill') }
  async shoot (e) { return ActionController.roleAction(e, 'shoot') }
}
