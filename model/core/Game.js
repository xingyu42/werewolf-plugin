import { SheriffTransferState } from "../action/SheriffTransferState.js";
import { NightState } from "../action/NightState.js";
import { Player } from "../Player.js";
import { RoleFactory } from "../roles/RoleFactory.js";
import { EventEmitter } from 'node:events';
import { GameError } from './GameError.js';
import { isValidTransition } from './StateMachine.js';
import { VictoryChecker } from './VictoryChecker.js';
import { RoleConfigurator } from "../configurators/RoleConfigurator.js";
import { GameEventHandler } from "./GameEventHandler.js";

/**
 * 游戏核心类 - 负责管理游戏状态、玩家和角色
 * 继承EventEmitter实现事件驱动的通信机制
 */
export class Game extends EventEmitter {
  constructor(e, config) {
    super(); // 调用EventEmitter构造函数
    this.players = new Map(); // 玩家信息
    this.roles = new Map(); // 角色实例
    this.currentState = null; // 当前游戏状态
    this.config = config; // 游戏配置
    this.turn = 0; // 游戏轮次
    this._changingState = false; // 状态切换锁
    this.eventErrors = []; // 事件错误日志
    this.stateHistory = []; // 状态历史记录
    this.maxHistoryLength = 50; // 最大历史记录长度
    this.playerNumberMap = new Map(); // 游戏内编号到玩家ID的映射
    this.stateTransitionContext = {}; // 存储状态转换相关的上下文信息

    this.eventHandler = new GameEventHandler(this, e);
    
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
    this.victoryChecker = new VictoryChecker();
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
  async init(config, gameManager) {
    this.config = config;
    this.gameManager = gameManager;
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
    this.currentState = new NightState(this);
  }

  // 状态转换
  async changeState(newState) {
    if (!newState) {
      const error = new GameError("新状态为 undefined", "INVALID_STATE");
      this.emit('error', error);
      return;
    }

    if (this._changingState) {
      this.emit('message', {
        type: 'group',
        content: "状态切换被阻止:当前正在进行状态转换"
      });
      return;
    }

    // 检查状态转换是否合法
    if (this.currentState) {
      const fromState = this.currentState.constructor.name;
      const toState = newState.constructor.name;
      
      const validationResult = isValidTransition(fromState, toState, this, this.stateTransitionContext);
      
      if (!validationResult.allowed) {
        const error = new GameError(
          `非法的状态转换: ${validationResult.reason}`, 
          "INVALID_STATE_TRANSITION"
        );
        this.emit('error', error);
        return;
      }
      
      // 如果状态转换被允许，记录状态历史
      this.recordStateHistory(this.currentState);
    }

    this._changingState = true;
    try {
      if (this.currentState) {
        await this.currentState.onExit();
      }

      this.currentState = newState;
      await this.currentState.onEnter();

    } catch (err) {
      console.error("状态转换时出错:", err);
      this.emit('error', new GameError(
        "游戏状态转换失败", 
        "STATE_TRANSITION_ERROR", 
        { cause: err }
      ));
    } finally {
      this._changingState = false;
    }
  }

  /**
   * 记录状态历史
   * @param {GameState} state 要记录的状态
   */
  recordStateHistory(state) {
    if (!state) return;
    
    // 记录状态类型和时间戳
    const historyEntry = {
      stateType: state.constructor.name,
      timestamp: new Date(),
      turn: this.turn
    };
    
    // 添加到历史记录
    this.stateHistory.push(historyEntry);
    
    // 限制历史记录长度
    if (this.stateHistory.length > this.maxHistoryLength) {
      this.stateHistory.shift();
    }
  }

  /**
   * 设置状态转换上下文
   * @param {Object} context 上下文对象
   */
  setStateTransitionContext(context) {
    this.stateTransitionContext = context || {};
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
      
      if (!this.currentState) {
        this.emit('error', new GameError(
          "游戏状态错误: 当前没有活动状态", 
          "NO_ACTIVE_STATE"
        ));
        return;
      }
      
      await this.currentState.handleAction(player, action, target);
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

    return this.currentState.isValidAction(player, action);
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
    return this.playerNumberMap.get(gameNumber.toString());
  }

  // 根据游戏内编号获取玩家
  getPlayerByNumber(gameNumber) {
    const playerId = this.getPlayerIdByNumber(gameNumber);
    if (!playerId) return null;
    return this.players.get(playerId);
  }

  /**
   * 获取存活玩家列表
   * @param {Object} options - 选项
   * @param {string[]} [options.excludeIds=[]] - 需要排除的玩家ID列表
   * @param {string} [options.excludeCamp] - 排除特定阵营 (WOLF/GOD/VILLAGER)
   * @param {string} [options.roleType] - 指定角色类型 (通过constructor.name匹配)
   * @param {boolean} [options.includeRole=false] - 是否在返回结果中包含角色对象
   * @returns {(Player[]|Array<{player: Player, role: Role}>)} 存活玩家列表或玩家与角色的对象数组
   */
  getAlivePlayers({ 
    excludeIds = [], excludeCamp = null, roleType = null, includeRole = false, showRole = false, showStatus = false 
  } = {}) {
    // 创建查询的缓存键
    const cacheKey = this._getAlivePlayersCacheKey({ excludeIds, excludeCamp, roleType, includeRole });
    
    // 检查是否有已缓存的结果
    const alivePlayersCache = this._cacheSystem.alivePlayers;
    
    // 针对不同查询类型使用不同缓存
    if (excludeCamp && alivePlayersCache.campExclusions[excludeCamp]) {
      return [...alivePlayersCache.campExclusions[excludeCamp]]; // 返回深拷贝
    }
    
    if (roleType && alivePlayersCache.roleTypes[roleType]) {
      // 返回角色类型缓存
      const cachedResult = alivePlayersCache.roleTypes[roleType];
      return includeRole ? [...cachedResult] : cachedResult.map(item => item.player);
    }
    
    // 基本的所有存活玩家缓存
    if (!excludeIds.length && !excludeCamp && !roleType) {
      if (alivePlayersCache.cache) {
        const cachedPlayers = alivePlayersCache.cache;
        
        if (!includeRole) {
          return [...cachedPlayers]; // 返回存活玩家的深拷贝
        }
        
        // 需要包含角色时转换
        return cachedPlayers.map(player => ({
          player,
          role: this.roles.get(player.id)
        }));
      }
      
      // 缓存不存在，计算所有存活玩家
      const allAlivePlayers = [...this.players.values()].filter(player => player.isAlive);
      alivePlayersCache.cache = allAlivePlayers; // 缓存结果
      
      if (!includeRole) {
        return [...allAlivePlayers];
      }
      
      // 包含角色时转换
      return allAlivePlayers.map(player => ({
        player,
        role: this.roles.get(player.id)
      }));
    }
    
    // 复杂查询，执行完整过滤
    const filteredPlayers = (alivePlayersCache.cache || [...this.players.values()].filter(player => player.isAlive))
      .filter(player => {
        // 检查是否在排除列表中
        if (excludeIds.includes(player.id)) return false;
        
        const role = this.roles.get(player.id);
        
        // 检查阵营
        if (excludeCamp && role?.getCamp() === excludeCamp) return false;
        
        // 检查角色类型
        if (roleType && role?.constructor.name !== roleType) return false;
        
        return true;
      });
    
    // 缓存特定查询结果
    if (excludeCamp && !excludeIds.length && !roleType) {
      alivePlayersCache.campExclusions[excludeCamp] = [...filteredPlayers];
    }
    
    if (roleType && !excludeIds.length && !excludeCamp) {
      const result = filteredPlayers.map(player => ({
        player,
        role: this.roles.get(player.id)
      }));
      alivePlayersCache.roleTypes[roleType] = result;
      return includeRole ? result : result.map(item => item.player);
    }

    // 如果需要包含角色对象，转换为{player, role}格式
    if (includeRole) {
      return filteredPlayers.map(player => ({
        player,
        role: this.roles.get(player.id)
      }));
    }
    
    return filteredPlayers;
  }

  // 获取当前游戏状态
  getCurrentState() {
    return this.currentState;
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
    const now = Date.now();
    this._cacheSystem.alivePlayers.cache = null;
    this._cacheSystem.alivePlayers.campExclusions = {};
    this._cacheSystem.alivePlayers.roleTypes = {};
    this._cacheSystem.alivePlayers.lastInvalidation = now;
  }

  /**
   * 获取缓存键
   * @private
   * @param {Object} options - 查询选项
   * @returns {string} 缓存键
   */
  _getAlivePlayersCacheKey(options) {
    const { excludeIds = [], excludeCamp = null, roleType = null, includeRole = false } = options;
    
    // 创建唯一缓存键
    return JSON.stringify({
      excludeIds: excludeIds.sort(), // 排序以确保相同内容产生相同键
      excludeCamp,
      roleType,
      includeRole
    });
  }
}
