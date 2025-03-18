import { Role } from './Role.js';

export class VillagerRole extends Role {
  constructor(game, player) {
    super(game, player);
  }

  getActionPrompt() {
    return '你是平民,请等待其他玩家行动';
  }
} 