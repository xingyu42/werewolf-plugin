export class GameState {
  constructor(game) {
    this.game = game;
    this.timeLimit = 0; // 默认无时间限制
    this.timer = null;
  }

  // 进入状态
  async onEnter() {
    // 确保game对象存在
    if (!this.game) {
      console.error(`${this.constructor.name}.onEnter: game 对象为 undefined`);
      return;
    }

    // 设置超时处理
    if (this.timeLimit > 0) {
      this.timer = setTimeout(async () => {
        await this.onTimeout();
      }, this.timeLimit * 1000);
    }
  }

  // 退出状态
  async onExit() {
    // 清除定时器
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  // 处理玩家行为
  async handleAction(player, action, data) {
    if (!this.game) {
      console.error(`${this.constructor.name}.handleAction: game 对象为 undefined`);
      return;
    }

    throw new Error("子类必须实现handleAction方法");
  }

  // 检查行动是否有效
  isValidAction(player, action) {
    if (!this.game) {
      console.error(`${this.constructor.name}.isValidAction: game 对象为 undefined`);
      return false;
    }

    return false; // 默认所有行动无效
  }

  // 获取当前状态名称
  getName() {
    return this.constructor.name;
  }

  // 超时处理
  async onTimeout() {
    if (!this.game) {
      console.error(`${this.constructor.name}.onTimeout: game 对象为 undefined`);
      return;
    }

    // 默认不做任何处理
  }
}
