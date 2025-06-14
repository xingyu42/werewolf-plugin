import { GameConfig, PlayerStats } from "../components/services.js";
import { GameRegistry } from "../model/services/GameRegistry.js";
import { GameLobby } from "../model/services/GameLobby.js";
import { Player } from "../model/Player.js";

// A simple in-memory store for active lobbies
const lobbies = new Map();

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
    if (GameRegistry.hasGame(e.group_id) || lobbies.has(e.group_id)) {
      e.reply("当前群已有游戏或大厅进行中");
      return true;
    }
    
    const lobby = new GameLobby(GameConfig);
    lobbies.set(e.group_id, lobby);
    
    const player = Player.fromEvent(e);
    lobby.addPlayer(player);

    e.reply(`游戏大厅创建成功，${player.name} 已自动加入游戏，其他玩家请输入 #加入狼人杀 参与`);
    return true;
  }

  // 辅助方法：获取当前群游戏实例，避免重复验证代码
  async _getGameInstance(e) {
    const gameInstance = GameRegistry.getGame(e.group_id);
    if (!gameInstance) {
      e.reply("当前群没有进行中的狼人杀");
      return null;
    }
    return gameInstance;
  }

  async joinGame(e) {
    if (GameRegistry.hasGame(e.group_id)) {
      e.reply("游戏已经开始，无法加入");
      return true;
    }

    const lobby = lobbies.get(e.group_id);
    if (!lobby) {
      e.reply("当前没有开放的游戏大厅，请先 #创建狼人杀");
      return true;
    }

    if (lobby.hasPlayer(e.user_id)) {
      e.reply("你已经在游戏中了");
      return true;
    }

    // 创建新玩家
    const player = Player.fromEvent(e);
    lobby.addPlayer(player);

    e.reply(`${player.name} 加入了游戏`);
    return true;
  }

  async startGame(e) {
    const lobby = lobbies.get(e.group_id);
    if (!lobby) {
      e.reply("没有找到可以开始的游戏大厅");
      return true;
    }

    // Create the game from the lobby
    const game = lobby.createGame(e.group_id, e);

    // Set up event listeners
    game.on('gameEnd', (result) => {
      this.playerStats.updateStats(game, result);
    });

    // The game's start method should handle its own initialization
    const result = await game.start();
    
    if (result) {
      e.reply("游戏开始!");
      // Clean up the lobby once the game starts
      lobbies.delete(e.group_id);
    }
    return true;
  }

  async endGame(e) {
    const groupId = e.group_id;
    
    // The Game's own destructor/cleanup should handle event removal.
    // We just remove the game from the manager.
    GameRegistry.removeGame(groupId);
    lobbies.delete(groupId); // Also clean up lobby if it exists
    e.reply("游戏已结束");
    return true;
  }
}

