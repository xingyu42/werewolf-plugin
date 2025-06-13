/**
 * 角色数据管理模块
 * 定义角色的权重、阵营和其他属性，为配置生成器提供数据支持
 * 基于PRD中的权重平衡系统设计
 */
export class RoleData {
  /**
   * 角色权重映射
   * 好人阵营（村民、神民）权重为正数，狼人阵营权重为负数
   * 权重绝对值越大表示对平衡的影响越大
   * 基于PRD中的权重平衡系统设计
   */
  static roleWeights = {
    "WOLF": -8,      // 狼人：负面权重
    "VILLAGER": 1,   // 村民：基础正面权重
    "PROPHET": 7,    // 预言家：高正面权重
    "WITCH": 4,      // 女巫：中高正面权重
    "HUNTER": 3,     // 猎人：中等正面权重
    "GUARD": 3       // 守卫：中等正面权重
  };
  
  /**
   * 角色阵营映射
   * 确保与RoleFactory中的阵营定义保持一致
   */
  static roleCamps = {
    "WOLF": "WOLF",       // 狼人阵营
    "VILLAGER": "VILLAGER", // 村民阵营
    "PROPHET": "GOD",     // 神民阵营
    "WITCH": "GOD",       // 神民阵营
    "HUNTER": "GOD",      // 神民阵营
    "GUARD": "GOD"        // 神民阵营
  };
  
  /**
   * 角色解锁人数映射
   * 定义每个角色在最少多少人的游戏中才能出现
   * 基于PRD中的特殊角色解锁原则
   */
  static roleUnlockCount = {
    "WOLF": 6,      // 基础角色，至少6人
    "VILLAGER": 6,  // 基础角色，至少6人
    "PROPHET": 6,   // 基础角色，至少6人
    "WITCH": 6,     // 基础角色，至少6人
    "HUNTER": 8,    // 8人及以上解锁
    "GUARD": 9      // 9人及以上解锁
  };
  
  /**
   * 角色描述映射
   * 为每个角色提供简短的描述
   */
  static roleDescriptions = {
    "WOLF": "每晚可以杀死一名玩家",
    "VILLAGER": "没有特殊技能的普通村民",
    "PROPHET": "每晚可以查验一名玩家的身份",
    "WITCH": "拥有一瓶救人药和一瓶毒药",
    "HUNTER": "被杀死后可以开枪带走一名玩家",
    "GUARD": "每晚可以保护一名玩家不被狼人杀死"
  };
  
  /**
   * 获取角色权重
   * @param {string} roleName - 角色名称
   * @returns {number} 角色权重值
   */
  static getWeight(roleName) {
    if (!roleName || typeof roleName !== 'string') {
      console.warn("无效的角色名称");
      return 0;
    }
    
    const weight = RoleData.roleWeights[roleName];
    if (weight === undefined) {
      console.warn(`未知角色: ${roleName}，使用默认权重0`);
      return 0;
    }
    
    return weight;
  }
  
  /**
   * 获取角色阵营
   * 与RoleFactory.getRoleCamp保持一致
   * @param {string} roleName - 角色名称
   * @returns {string} 角色阵营 ("WOLF" | "VILLAGER" | "GOD")
   * @throws {Error} 当角色类型未知时抛出错误
   */
  static getCamp(roleName) {
    if (!roleName || typeof roleName !== 'string') {
      throw new Error("无效的角色名称");
    }
    
    const camp = RoleData.roleCamps[roleName];
    if (!camp) {
      throw new Error(`未知的角色类型: ${roleName}`);
    }
    
    return camp;
  }
  
  /**
   * 获取角色在游戏中解锁所需的最小人数
   * @param {string} roleName - 角色名称
   * @returns {number} 解锁所需的最小人数
   */
  static getUnlockCount(roleName) {
    if (!roleName || typeof roleName !== 'string') {
      console.warn("无效的角色名称");
      return 6; // 默认最低人数
    }
    
    const unlockCount = RoleData.roleUnlockCount[roleName];
    if (unlockCount === undefined) {
      console.warn(`未知角色: ${roleName}，使用默认解锁人数6`);
      return 6;
    }
    
    return unlockCount;
  }
  
  /**
   * 获取角色描述
   * @param {string} roleName - 角色名称
   * @returns {string} 角色描述
   */
  static getDescription(roleName) {
    if (!roleName || typeof roleName !== 'string') {
      return "未知角色";
    }
    
    return RoleData.roleDescriptions[roleName] || "未知角色描述";
  }
  
  /**
   * 获取所有可用角色列表
   * @returns {Array<string>} 所有角色名称数组
   */
  static getAllRoles() {
    return Object.keys(RoleData.roleWeights);
  }
  
  /**
   * 获取指定人数下可用的角色列表
   * @param {number} playerCount - 玩家人数
   * @returns {Array<string>} 可用角色名称数组
   */
  static getAvailableRoles(playerCount) {
    if (!Number.isInteger(playerCount) || playerCount < 6) {
      return [];
    }
    
    return RoleData.getAllRoles().filter(
      roleName => RoleData.getUnlockCount(roleName) <= playerCount
    );
  }
  
  /**
   * 获取指定阵营的所有角色
   * @param {string} camp - 阵营名称 ("WOLF" | "VILLAGER" | "GOD")
   * @returns {Array<string>} 该阵营的所有角色名称
   */
  static getRolesByCamp(camp) {
    if (!camp || typeof camp !== 'string') {
      return [];
    }
    
    return RoleData.getAllRoles().filter(
      roleName => {
        try {
          return RoleData.getCamp(roleName) === camp;
        } catch (error) {
          return false;
        }
      }
    );
  }
  
  /**
   * 判断角色是否为狼人阵营
   * @param {string} roleName - 角色名称
   * @returns {boolean} 是否为狼人阵营
   */
  static isWolf(roleName) {
    try {
      return RoleData.getCamp(roleName) === "WOLF";
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 判断角色是否为神民
   * @param {string} roleName - 角色名称
   * @returns {boolean} 是否为神民
   */
  static isGod(roleName) {
    try {
      return RoleData.getCamp(roleName) === "GOD";
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 判断角色是否为普通村民
   * @param {string} roleName - 角色名称
   * @returns {boolean} 是否为普通村民
   */
  static isVillager(roleName) {
    try {
      return roleName === "VILLAGER";
    } catch (error) {
      return false;
    }
  }
} 