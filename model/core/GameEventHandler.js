import { EventEmitter } from 'node:events';

/**
 * 游戏事件处理器 - 负责处理Game实例发出的事件并转发到通信层
 * 用于解耦游戏核心逻辑与外部通信
 */
export class GameEventHandler {
  /**
   * 创建游戏事件处理器
   * @param {Game} game 游戏实例
   * @param {Object} e 通信句柄
   */
  constructor(game, e) {
    this.game = game;
    this.e = e;
    
    // 设置游戏事件监听
    this.setupEventListeners();
  }
  
  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 监听消息事件
    this.game.on('message', (data) => {
      const { type, content, target } = data;
      
      if (type === 'group') {
        // 发送群消息
        this.e.reply(content);
      } else if (type === 'private') {
        // 发送私聊消息
        this.e.bot.sendPrivateMsg(target, content);
      }
    });
    
    // 监听错误事件
    this.game.on('error', (error) => {
      // 记录详细错误信息
      console.error('游戏错误:', error.getFormattedMessage(), error.toJSON());
      
      // 根据错误类型提供友好的用户反馈
      let userMessage = `操作失败: ${error.message}`;
      
      // 对特定错误类型提供更友好的提示
      switch (error.code) {
        case 'INVALID_PLAYER':
          userMessage = '无效的玩家操作，请确认您是游戏参与者';
          break;
        case 'PLAYER_NOT_FOUND':
          userMessage = '玩家不存在，请确认游戏号码';
          break;
        case 'INVALID_ACTION':
          userMessage = '当前阶段无法执行该操作';
          break;
        case 'STATE_TRANSITION_ERROR':
          userMessage = '游戏状态转换错误，请联系管理员';
          break;
        case 'NO_ACTIVE_STATE':
          userMessage = '游戏尚未开始或已结束';
          break;
        case 'VOTE_ERROR':
          userMessage = '投票操作失败，请检查目标是否有效';
          break;
        case 'SHERIFF_ELECT_ERROR':
          userMessage = '警长竞选操作失败，请稍后再试';
          break;
        case 'GUARD_ACTION_ERROR':
        case 'PROPHET_ACTION_ERROR':
        case 'WITCH_POISON_ERROR':
        case 'WITCH_SAVE_ERROR':
          userMessage = `${error.message} (角色操作失败)`;
          break;
        // 可根据需要添加更多错误类型的处理
      }
      
      // 发送反馈给用户
      this.e.reply(userMessage);
      
      // 记录错误到游戏实例以供后续分析
      if (this.game.eventErrors) {
        this.game.eventErrors.push({
          timestamp: new Date(),
          error: error.toJSON()
        });
        
        // 限制错误日志数量，避免内存泄漏
        if (this.game.eventErrors.length > 100) {
          this.game.eventErrors.shift();
        }
      }
    });
    
    // 监听游戏结束事件
    this.game.on('gameEnd', (data) => {
      const { winner, reason, alivePlayers } = data;
      this.e.reply(`游戏结束！\n获胜阵营：${winner}\n胜利原因：${reason}\n存活玩家：\n${alivePlayers}`);
    });
    
    // 监听新一天开始事件
    this.game.on('newDay', (data) => {
      const { turn } = data;
      this.e.reply(`=== 第${turn}天 ===`);
    });
    
    // 监听角色通知事件
    this.game.on('roleNotify', (data) => {
      const { playerId, message } = data;
      this.e.bot.sendPrivateMsg(playerId, message);
    });
    
    // 监听玩家死亡事件
    this.game.on('playerDeath', (data) => {
      const { player, reason } = data;
      let deathMessage = `玩家 ${player.gameNumber}号 ${player.name} 已死亡`;
      
      // 根据死亡原因提供不同的消息
      switch (reason) {
        case 'WOLF_KILL':
          deathMessage += "（被狼人杀死）";
          break;
        case 'EXILE':
          deathMessage += "（被放逐出村）";
          break;
        case 'POISON':
          deathMessage += "（中毒身亡）";
          break;
        case 'HUNTER_SHOT':
          deathMessage += "（被猎人射杀）";
          break;
      }
      
      this.e.reply(deathMessage);
    });
  }
} 