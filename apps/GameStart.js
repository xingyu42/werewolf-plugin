import { Game } from "../model/core/Game.js";
import { GameConfig, PlayerStats } from "../components/services.js";
import { GameManager } from "../model/GameManager.js";
import { Player } from "../model/Player.js";

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

    this.playerStats = PlayerStats;
  }

  async createGame(e) {
    if (GameManager.hasGame(e.group_id)) {
      e.reply("当前群已有游戏进行中");
      return true;
    }
    
    // Game's constructor will now handle the event handler
    const game = new Game(e, GameConfig);

    // 将游戏实例添加到管理器
    GameManager.addGame(e.group_id, game);

    // 游戏结束时更新统计 - This logic remains here as it connects the game instance to a persistent stat service
    game.on('gameEnd', (result) => {
      this.playerStats.updateStats(game, result);
    });

    // 创建的玩家自动加入游戏
    const player = Player.fromEvent(e);
    game.addPlayer(player); // Assuming Game has an addPlayer method now

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

    if (gameInstance.hasPlayer(e.user_id)) {
      e.reply("你已经在游戏中了");
      return true;
    }

    // 创建新玩家
    const player = Player.fromEvent(e);
    gameInstance.addPlayer(player); // Assuming Game has an addPlayer method

    e.reply(`${player.name} 加入了游戏`);
    return true;
  }

  async startGame(e) {
    const gameInstance = await this._getGameInstance(e);
    if (gameInstance === null) return;

    // The game's start method should handle its own initialization
    const result = await gameInstance.start();
    
    if (result) {
      e.reply("游戏开始!");
    }
    return true;
  }

  async endGame(e) {
    const groupId = e.group_id;
    
    // The Game's own destructor/cleanup should handle event removal.
    // We just remove the game from the manager.
    GameManager.removeGame(groupId);
    e.reply("游戏已结束");
    return true;
  }
}

