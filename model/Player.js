/**
 * Player.js - 玩家类
 * 封装玩家数据和行为
 */

export class Player {
  /**
   * 构造函数
   * @param {Object} options - 玩家信息选项
   * @param {string} options.id - 玩家ID
   * @param {string} [options.card] - 群名片
   * @param {string} [options.nickname] - 群昵称
   * @param {string} [options.senderNickname] - 发送者昵称
   * @param {string} [options.role] - 玩家角色
   * @param {boolean} [options.isCreator=false] - 是否为游戏创建者
   * @param {boolean} [options.isAlive=true] - 是否存活
   * @param {boolean} [options.isSheriff=false] - 是否为警长
   * @param {number} [options.gameNumber=null] - 游戏内编号
   */
  constructor({ id, card, nickname, senderNickname, role = null, isCreator = false, isAlive = true, isSheriff = false, gameNumber = null }) {
    this.id = id;
    this._card = card;
    this._nickname = nickname;
    this._senderNickname = senderNickname;
    this._role = role;
    this.isCreator = isCreator;
    this.isAlive = isAlive;
    this.isSheriff = isSheriff;
    this.votedBy = new Set();
    this.protected = false; // 被守卫保护
    this.gameNumber = gameNumber; // 游戏内编号
    this.deathReason = null; // 死亡原因: WOLF_KILL(狼人杀死), EXILE(放逐), POISON(毒杀), HUNTER_SHOT(猎人射杀)
  }

  /**
   * 获取玩家显示名称
   * 优先级：群名片 > 群昵称 > 发送者昵称 > "未知玩家"
   */
  get name() {
    return this._card || this._nickname || this._senderNickname || "未知玩家";
  }

  /**
   * 获取玩家角色
   */
  get role() {
    return this._role;
  }

  /**
   * 设置玩家角色
   */
  set role(value) {
    this._role = value;
  }

  /**
   * 从事件对象创建玩家实例
   * @param {Object} e - 事件对象
   * @param {Object} [options] - 额外选项
   * @returns {Player} 玩家实例
   */
  static fromEvent(e, options = {}) {
    return new Player({
      id: e.user_id,
      card: e.member?.card,
      nickname: e.member?.nickname,
      senderNickname: e.sender?.nickname,
      ...options,
    });
  }

}
