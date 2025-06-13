import { Game } from "../model/core/Game.js";
import GameConfig from "../components/GameConfig.js";
import { GameManager } from "../model/GameManager.js";
import { Player } from "../model/Player.js";
import { GameEventHandler } from "../model/core/GameEventHandler.js";
import { PlayerStats } from "../model/stats/PlayerStats.js";

export class GameStart extends plugin {
  constructor() {
    super({
      name: "狼人杀",
      dsc: "狼人杀游戏",
      event: "message",
      priority: 5000,
      rule: [
        { reg: "^#创建(狼人杀|lrs)$", fnc: "createGame" },
        { reg: "^#加入(狼人杀|lrs)$", fnc: "joinGame" },
        { reg: "^#开始(狼人杀|lrs)$", fnc: "startGame" },
        { reg: "^#结束(狼人杀|lrs)$", fnc: "endGame" },
      ],
    });

    this.playerStats = new PlayerStats();
    this.mutedPlayers = new Map();
    this.eventHandlers = new Map(); // 存储每个群的事件处理器
  }

  async createGame(e) {
    if (GameManager.hasGame(e.group_id)) {
      e.reply("当前群已有游戏进行中");
      return true;
    }

    const gameManager = new GameManager(GameConfig);
    const game = new Game();
    
    // 创建事件处理器，连接Game和e
    const eventHandler = new GameEventHandler(game, e);
    this.eventHandlers.set(e.group_id, eventHandler);
    
    // 只初始化游戏配置和管理器，但不初始化玩家，避免在没有玩家时报错
    game.config = GameConfig;
    game.gameManager = gameManager;

    // 将游戏实例添加到管理器
    GameManager.addGame(e.group_id, game);

    // 游戏结束时更新统计
    game.on('gameEnd', (result) => {
      this.playerStats.updateStats(game, result);
    });

    // 创建的玩家自动加入游戏
    const player = Player.fromEvent(e);
    gameManager.addPlayer(player);

    e.reply(`游戏创建成功，${player.name} 已自动加入游戏，其他玩家请输入 #加入狼人杀 参与`);
    return true;
  }

  // 辅助方法：获取当前群游戏实例，避免重复验证代码
  async _getGameInstance(e) {
    const gameInstance = GameManager.getGame(e.group_id);
    if (!gameInstance) {
      e.reply("当前群没有进行中的狼人杀");
      return null;
    }
    return gameInstance;
  }

  async joinGame(e) {
    const gameInstance = await this._getGameInstance(e);
    if (gameInstance === null) return;

    if (gameInstance.gameManager.hasPlayer(e.user_id)) {
      e.reply("你已经在游戏中了");
      return true;
    }

    // 创建新玩家
    const player = Player.fromEvent(e);
    gameInstance.gameManager.addPlayer(player);

    e.reply(`${player.name} 加入了游戏`);
    return true;
  }

  async startGame(e) {
    const gameInstance = await this._getGameInstance(e);
    if (gameInstance === null) return;

    // 现在，只有在startGame时才会调用游戏的init和start方法
    // 首先调用init方法初始化
    await gameInstance.init(GameConfig, gameInstance.gameManager);
    
    // 然后再调用start方法开始游戏
    const result = await gameInstance.start();
    
    if (result) {
      e.reply("游戏开始!");
    }
    return true;
  }

  async endGame(e) {
    const groupId = e.group_id;
    
    // 移除事件处理器
    if (this.eventHandlers.has(groupId)) {
      // 移除所有事件监听器
      const game = GameManager.getGame(groupId);
      if (game) {
        game.removeAllListeners();
      }
      this.eventHandlers.delete(groupId);
    }
    
    GameManager.removeGame(groupId);
    e.reply("游戏已结束");
    return true;
  }
}

