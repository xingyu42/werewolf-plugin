import { SheriffTransferState } from "../action/SheriffTransferState.js";
import { NightState } from "../action/NightState.js";
import { Player } from "../Player.js";
import { RoleFactory } from "../roles/RoleFactory.js";
export class Game {
  constructor() {
    this.players = new Map(); // 玩家信息
    this.roles = new Map(); // 角色实例
    this.currentState = null; // 当前游戏状态
    this.config = null; // 游戏配置
    this.gameManager = null; // 游戏管理器
    this.turn = 0; // 游戏轮次
    this._changingState = false; // 状态切换锁
    this.eventErrors = []; // 事件错误日志
    this.stateHistory = []; // 状态历史记录
    this.maxHistoryLength = 50; // 最大历史记录长度
    this.playerNumberMap = new Map(); // 游戏内编号到玩家ID的映射
  }

  // 初始化游戏
  async init(config, gameManager) {
    this.config = config;
    this.gameManager = gameManager;
    await this.initPlayers();
    this.initState();
  }

  // 初始化玩家
  async initPlayers() {
    // 清空现有玩家和角色
    this.players.clear();
    this.roles.clear();
    this.playerNumberMap.clear(); // 清空编号映射

    // 分配角色
    const roles = this.gameManager.getRoleList();
    const shuffledRoles = this.shuffle(roles);
    const players = this.gameManager.getPlayers();

    for (let i = 0; i < players.length; i++) {
      const playerInfo = players[i];
      const roleName = shuffledRoles[i];
      const gameNumber = i + 1; // 分配游戏内编号，从1开始

      // 创建玩家实例
      const player = new Player({
        ...playerInfo,
        role: roleName,
        gameNumber: gameNumber, // 设置游戏内编号
      });

      this.players.set(player.id, player); // 添加玩家到玩家列表
      this.playerNumberMap.set(gameNumber.toString(), player.id); // 添加编号到ID的映射

      // 创建角色实例
      const role = RoleFactory.createRole(roleName, this, player);
      this.roles.set(player.id, role);

      // 发送角色通知 - 加入编号信息
      this.e.bot.sendPrivateMsg(player.id, `你的游戏编号是：${gameNumber}号，角色是：${player.role}`);
    }
  }

  // 初始化游戏状态
  initState() {
    // 修改为从夜晚开始
    this.currentState = new NightState(this);
  }

  // 状态转换
  async changeState(newState) {
    if (!newState) {
      console.error("Game.changeState: 新状态为 undefined");
      return;
    }

    if (this._changingState) {
      console.warn("状态切换被阻止:当前正在进行状态转换");
      return;
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
      this.e.reply("游戏状态转换失败", { cause: err });
    } finally {
      this._changingState = false;
    }
  }

  // 处理玩家行为
  async handleAction(player, action, target, e) {
    if (!player) {
      console.error("Game.handleAction: player 参数为 undefined");
      return;
    }

    try {
      // 如果传入的是playerId而不是player对象，则获取player对象
      if (typeof player === "string") {
        const playerId = player;
        player = this.players.get(playerId);
        if (!player) {
          e.reply(`玩家不存在: ${playerId}`);
        }
      }
      if (!this.isValidAction(player, action)) {
        e.reply("非法操作: 玩家无法执行该动作");
      }
      if (!this.currentState) {
        e.reply("游戏状态错误: 当前没有活动状态");
      }
      await this.currentState.handleAction(player, action, target);
    } catch (err) {
      // 记录错误
      console.error("处理玩家行为时出错:", err);

      // 通知玩家
      e.reply(`操作失败: ${err.message}`);
    }
  }

  // 检查行为是否有效
  isValidAction(player, action) {
    if (!player || !player.isAlive) return false;

    return this.currentState.isValidAction(player, action);
  }

  // 结束游戏
 async endGame() {
  // 计算各阵营存活人数
  const aliveWolves = this.getAlivePlayers({ excludeCamp: 'WOLF' }).length;
  const aliveGods = this.getAlivePlayers({ excludeCamp: 'GOD' }).length;
  const aliveVillagers = this.getAlivePlayers({ excludeCamp: 'VILLAGER' }).length;

  // 胜利判定
  let winner = null;
  let gameOver = false;
  let reason = "";
  let tubian = this.config.game.enableTubian;

  // 判断是否有阵营胜利
  if (aliveWolves === 0) {
    // 狼人全部死亡，好人胜利
    winner = "好人";
    reason = "狼人全部出局";
    gameOver = true;
  } else if (aliveGods === 0 && aliveVillagers === 0) {
    // 所有神职和平民都死亡，狼人胜利
    winner = "狼人";
    reason = "好人全部出局";
    gameOver = true;
  } else if (tubian && aliveGods === 0) {
    // 屠边规则：所有神职都死亡，狼人胜利
    winner = "狼人";
    reason = "神职全部出局";
    gameOver = true;
  } else if (tubian && aliveVillagers === 0) {
    // 屠边规则：所有平民都死亡，狼人胜利
    winner = "狼人";
    reason = "平民全部出局";
    gameOver = true;
  }

  // 如果游戏结束，显示结果
  if (gameOver) {
    const alivePlayersStr = this.getAlivePlayers({ showRole: true, showStatus: true }).map((p) => p.getDisplayInfo()).join("\n");

    this.e.reply(`游戏结束！\n获胜阵营：${winner}\n胜利原因：${reason}\n存活玩家：\n${alivePlayersStr}`);
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
    // 发送新的一天开始的消息
    this.e.reply(`=== 第${this.turn}天 ===`);
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
  excludeIds = [], excludeCamp = null,roleType = null,includeRole = false } = {}) {
  const filteredPlayers = [...this.players.values()].filter(player => {
    // 检查是否存活
    if (!player.isAlive) return false;
    
    // 检查是否在排除列表中
    if (excludeIds.includes(player.id)) return false;
    
    const role = this.roles.get(player.id);
    
    // 检查阵营
    if (excludeCamp && role?.getCamp() === excludeCamp) return false;
    
    // 检查角色类型
    if (roleType && role?.constructor.name !== roleType) return false;
    
    return true;
  });

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
  async start(e) {

    if (this.players.size < 6) {
      e.reply("玩家数量不足，至少需要6名玩家");
      return false;
    }

    // 分配角色
    await this.initPlayers();

    // 设置初始状态
    this.initState();

    // 开始第一天
    await this.startNewDay();
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
      
      // 3 处理警长死亡 //TODO:警长死亡会立即调用
      if (player.isSheriff) {
        const alivePlayers = this.getAlivePlayers({ excludeIds: [player.id] });
        
        if (alivePlayers.length > 0) {
          await this.changeState(new SheriffTransferState(this, player, this.currentState));
        } else {
          player.isSheriff = false;
        }
      }

      // 4. 检查游戏是否结束
      await this.endGame();

      return true;
    } catch (err) {
      console.error("处理玩家死亡时出错:", err);
      return false;
    }
  }
}
