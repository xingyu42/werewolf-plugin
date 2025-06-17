import { Role } from './Role.js'

export class VillagerRole extends Role {
  constructor (game, player, e) {
    super(game, player, e)
    this.name = '村民'
  }

  getActionPrompt () {
    return '你是平民,请等待其他玩家行动'
  }
}
