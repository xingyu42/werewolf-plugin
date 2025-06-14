import { SheriffTransferState } from "../action/SheriffTransferState.js";
import { NightState } from "../action/NightState.js";
import { Player } from "../Player.js";
import { RoleFactory } from "../roles/RoleFactory.js";
import { EventEmitter } from 'node:events';
import { GameError } from './GameError.js';
import { StateMachine } from './StateMachine.js';
import { VictoryChecker } from './VictoryChecker.js';
import { RoleConfigurator } from "../configurators/RoleConfigurator.js";
import { GameEventHandler } from "./GameEventHandler.js";
import { PlayerQueryService } from '../services/PlayerQueryService.js';

/**
 * 游戏核心类 - 负责管理游戏状态、玩家和角色
 * 继承EventEmitter实现事件驱动的通信机制
 */
export class Game extends EventEmitter {
  constructor({ e, config, players, stateMachine, playerQueryService, victoryChecker, eventHandler }) {
    super(); // 调用EventEmitter构造函数
    this.players = players || new Map();
    this.roles = new Map();
    this.config = config;
    this.turn = 0;
    this.eventErrors = [];
    this.playerNumberMap = new Map();

    this.stateMachine = stateMachine;
    this.stateMachine.setContext(this);

    this.playerQueryService = playerQueryService;
    this.playerQueryService.setContext(this.players, this.roles, this.playerNumberMap, this._cacheSystem);

    this.eventHandler = eventHandler || new GameEventHandler(this, e);
    
    // 缓存系统
    this._cacheSystem = {
      alivePlayers: {
        cache: null,           // 基本存活玩家缓存
        campExclusions: {},    // 按阵营排除的缓存
        roleTypes: {},         // 按角色类型的缓存
        lastInvalidation: Date.now() // 上次缓存失效时间
      }
    };
    
    // 胜利条件检查器
    this.victoryChecker = victoryChecker || new VictoryChecker();
  }

  addPlayer(player) {
    if (this.players.has(player.id)) {
      return false; // Player already in game
    }
    this.players.set(player.id, player);
    return true;
  }

  hasPlayer(playerId) {
    return this.players.has(playerId);
  }

  // 初始化游戏
  async init(config) {
    this.config = config;
    await this.initPlayers();
    this.initState();
    this._invalidateCache(); // 初始化时清空缓存
  }

  // 初始化玩家
  async initPlayers() {
    // 清空现有玩家和角色
    this.players.clear();
    this.roles.clear();
    this.playerNumberMap.clear(); // 清空编号映射

    // 分配角色
    const players = Array.from(this.players.values()); // Use internal player list
    const roles = RoleConfigurator.generate(players.length);
    const shuffledRoles = this.shuffle(roles);

    for (let i = 0; i < players.length; i++) {
      const playerInfo = players[i];
      const roleName = shuffledRoles[i];
      const gameNumber = i + 1; // 分配游戏内编号，从1开始

      // 更新玩家实例，而不是创建新的
      playerInfo.role = roleName;
      playerInfo.gameNumber = gameNumber;

      // 创建角色实例
      const role = RoleFactory.createRole(roleName, this, playerInfo);
      this.roles.set(playerInfo.id, role);

      // 发送角色通知 - 使用事件取代直接通信
      this.emit('roleNotify', {
        playerId: playerInfo.id,
        message: `你的游戏编号是：${gameNumber}号，角色是：${playerInfo.role}`
      });
    }
    
    // 初始化玩家后清空缓存
    this._invalidateCache();
  }

  // 初始化游戏状态
  initState() {
    // 修改为从夜晚开始
    const initialState = new NightState(this);
    this.stateMachine.changeState(initialState);
  }

  // 状态转换 (委派给StateMachine)
  async changeState(newState) {
    await this.stateMachine.changeState(newState);
  }

  /**
   * 设置状态转换上下文 (委派给StateMachine)
   * @param {Object} context 上下文对象
   */
  setStateTransitionContext(context) {
    this.stateMachine.setStateTransitionContext(context);
  }

  // 处理玩家行为
  async handleAction(player, action, target) {
    if (!player) {
      this.emit('error', new GameError(
        "player 参数为 undefined", 
        "INVALID_PLAYER"
      ));
      return;
    }

    try {
      // 如果传入的是playerId而不是player对象，则获取player对象
      if (typeof player === "string") {
        const playerId = player;
        player = this.players.get(playerId);
        if (!player) {
          this.emit('error', new GameError(
            `玩家不存在: ${playerId}`, 
            "PLAYER_NOT_FOUND"
          ));
          return;
        }
      }
      
      if (!this.isValidAction(player, action)) {
        this.emit('error', new GameError(
          "非法操作: 玩家无法执行该动作", 
          "INVALID_ACTION"
        ));
        return;
      }
      
      const currentState = this.stateMachine.getCurrentState();
      if (!currentState) {
        this.emit('error', new GameError(
          "游戏状态错误: 当前没有活动状态", 
          "NO_ACTIVE_STATE"
        ));
        return;
      }
      
      await currentState.handleAction(player, action, target);
    } catch (err) {
      // 记录错误并发出错误事件
      console.error("处理玩家行为时出错:", err);
      this.emit('error', new GameError(
        err.message, 
        "ACTION_ERROR", 
        { player, action, target }
      ));
    }
  }

  // 检查行为是否有效
  isValidAction(player, action) {
    if (!player || !player.isAlive) return false;

    const currentState = this.stateMachine.getCurrentState();
    if (!currentState) return false; // Add a guard for safety

    return currentState.isValidAction(player, action);
  }

  // 结束游戏
  async endGame() {
    // 使用胜利条件检查器检查游戏是否结束
    const victoryResult = this.victoryChecker.checkVictory(this);
    
    // 如果游戏结束，发出游戏结束事件
    if (victoryResult.gameOver) {
      const alivePlayersStr = this.getAlivePlayers({ showRole: true, showStatus: true }).map((p) => p.getDisplayInfo()).join("\n");

      this.emit('gameEnd', {
        winner: victoryResult.winner,
        reason: victoryResult.reason,
        alivePlayers: alivePlayersStr
      });
      
      return true;
    }

    return false;
  }

  // 工具方法:打乱数组
  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async startNewDay() {
    this.turn++;
    // 发送新的一天开始的消息，使用事件替代直接通信
    this.emit('newDay', { turn: this.turn });
  }

  // 根据游戏内编号获取玩家ID
  getPlayerIdByNumber(gameNumber) {
    return this.playerQueryService.getPlayerIdByNumber(gameNumber);
  }

  // 根据游戏内编号获取玩家
  getPlayerByNumber(gameNumber) {
    return this.playerQueryService.getPlayerByNumber(gameNumber);
  }

  getAlivePlayers(options) {
    return this.playerQueryService.getAlivePlayers(options);
  }

  // 获取当前状态 (委派给StateMachine)
  getCurrentState() {
    return this.stateMachine.getCurrentState();
  }

  // 获取游戏玩家
  getPlayerById(playerId) {
    return this.players.get(playerId);
  }

  // 获取配置
  getConfig() {
    return this.config;
  }

  // 开始游戏
  async start() {
    if (this.players.size < this.config.minPlayers) {
        this.emit('message', {
            type: 'group',
            content: `游戏人数不足，无法开始（需要 ${this.config.minPlayers} 人，当前 ${this.players.size} 人）。`
        });
        return false;
    }
    await this.initPlayers();
    this.initState();
    this._invalidateCache();
    
    this.emit('gameStart'); // Announce game start
    
    // The first state's onEnter will handle the initial messages
    return true;
  }

  /**
   * 统一处理玩家死亡
   */
  async handlePlayerDeath(player, reason) {
    if (!player || !player.isAlive) return false;

    try {
      // 1. 设置玩家死亡状态
      player.isAlive = false;
      player.deathReason = reason;

      // 2. 添加死亡标记
      switch (reason) {
        case 'WOLF_KILL': //被狼人杀死
        case 'EXILE': //被投票放逐
        case 'POISON': //被毒药毒死
        case 'HUNTER_SHOT': //被猎人射杀
        default: 
      }

      // 玩家状态改变，清空缓存
      this._invalidateCache();

      // 通知玩家死亡
      this.emit('playerDeath', { 
        player, 
        reason 
      });

      // 4. 检查游戏是否结束
      await this.endGame();

      return true;
    } catch (err) {
      console.error("处理玩家死亡时出错:", err);
      this.emit('error', new GameError(
        "处理玩家死亡时出错", 
        "PLAYER_DEATH_ERROR",
        { playerId: player.id, reason, error: err }
      ));
      return false;
    }
  }

  /**
   * 清除缓存系统中的所有缓存
   * @private
   */
  _invalidateCache() {
    // 使整个缓存系统失效
    this._cacheSystem.alivePlayers.cache = null; 
    this._cacheSystem.alivePlayers.lastInvalidation = Date.now();
  }
}
