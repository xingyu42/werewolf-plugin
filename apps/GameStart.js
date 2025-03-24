import { Game } from "../model/core/Game.js";
import GameConfig from "../components/GameConfig.js";
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

    this.mutedPlayers = new Map();
  }

  async createGame(e) {
    if (GameManager.hasGame(e.group_id)) {
      e.reply("当前群已有游戏进行中");
      return true;
    }

    const gameManager = new GameManager(GameConfig);
    const game = new Game();
    // 初始化游戏,传入事件对象
    await game.init(GameConfig, gameManager);

    GameManager.addGame(e.group_id, game);

    e.reply("游戏创建成功,请输入 #加入狼人杀 参与");
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

    await gameInstance.game.start(e);
    e.reply("游戏开始!");
    return true;
  }

  async endGame(e) {
    const groupId = e.group_id;
    GameManager.removeGame(groupId);
    e.reply("游戏已结束");
    return true;
  }
}

