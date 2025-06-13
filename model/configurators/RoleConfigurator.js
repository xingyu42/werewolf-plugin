/**
 * 角色配置生成器
 * 基于PRD中的权重平衡系统，为不同人数的游戏动态生成或选择平衡、合理的角色配置
 */
import { GameTemplates } from './GameTemplates.js';
import { RoleData } from './RoleData.js';

export class RoleConfigurator {
  // 配置缓存: 玩家人数 -> 角色配置数组
  static configCache = new Map();
  
  // 最近生成的配置历史记录
  static recentConfigs = [];
  
  // 最大历史记录长度
  static MAX_HISTORY_LENGTH = 10;
  
  /**
   * 生成角色配置
   * 根据玩家人数生成平衡合理的角色配置
   * @param {number} playerCount - 玩家人数
   * @param {Object} options - 可选参数
   * @param {boolean} [options.avoidRepeat=true] - 是否避免重复配置
   * @param {Object} [options.constraints] - 角色约束条件
   * @returns {Array<string>} 角色名称数组
   * @throws {Error} 如果无法生成有效配置或玩家人数不支持
   */
  static generate(playerCount, options = {}) {
    // 验证输入
    if (!Number.isInteger(playerCount) || playerCount < 6) {
      throw new Error(`玩家人数必须是大于或等于6的整数，当前: ${playerCount}`);
    }
    
    try {
      // 检查缓存
      const cacheKey = JSON.stringify({ playerCount, options });
      if (RoleConfigurator.configCache.has(cacheKey)) {
        return [...RoleConfigurator.configCache.get(cacheKey)];
      }
      
      // 选择合适的角色配置 - V1版本基于预定义模板
      let config = RoleConfigurator._selectTemplate(playerCount, options);
      
      // 如果启用避免重复，且该配置最近使用过，尝试生成变化
      if (options.avoidRepeat !== false && RoleConfigurator._isRecentlyUsed(config)) {
        config = RoleConfigurator._generateVariation(config, playerCount);
      }
      
      // 验证配置平衡性
      if (!RoleConfigurator.validateConfig(config)) {
        console.warn(`生成的配置不平衡: ${config.join(',')}`);
        // 尝试生成备选配置
        config = RoleConfigurator._generateBalancedConfig(playerCount);
      }
      
      // 记录本次配置
      RoleConfigurator._recordConfig(config);
      
      // 缓存配置以提升性能
      RoleConfigurator.configCache.set(cacheKey, [...config]);
      
      return config;
    } catch (error) {
      console.error("角色配置生成失败:", error);
      // 生成基础配置作为回退机制，确保游戏可以继续
      return RoleConfigurator._generateFallbackConfig(playerCount);
    }
  }
  
  /**
   * 验证配置是否平衡
   * 基于PRD中的游戏平衡验证指标
   * @param {Array<string>} config - 角色配置
   * @returns {boolean} 是否平衡
   */
  static validateConfig(config) {
    if (!config || config.length === 0) return false;
    
    // 计算阵营力量
    let goodPower = 0;
    let evilPower = 0;
    let wolfCount = 0;
    
    // 临时简化版：根据角色类型计算权重
    for (const role of config) {
      const weight = RoleData.getWeight(role);
      if (weight > 0) {
        goodPower += weight;
      } else if (weight < 0) {
        evilPower += Math.abs(weight);
      }
      
      if (RoleData.isWolf(role)) {
        wolfCount++;
      }
    }
    
    // 计算阵营力量比: 狼人阵营力量 / 总力量
    const totalPower = goodPower + evilPower;
    if (totalPower === 0) return false;
    
    const evilRatio = evilPower / totalPower;
    
    // 验证狼人比例: 15%-35%
    const wolfRatio = wolfCount / config.length;
    
    // 基于PRD要求: 阵营力量比在0.4-0.6之间，狼人比例在15%-35%之间
    return evilRatio >= 0.4 && evilRatio <= 0.6 && wolfRatio >= 0.15 && wolfRatio <= 0.35;
  }
  
  /**
   * 选择合适的角色配置模板
   * @private
   * @param {number} playerCount - 玩家人数
   * @param {Object} options - 可选参数
   * @returns {Array<string>} 角色配置数组
   * @throws {Error} 如果没有合适的模板
   */
  static _selectTemplate(playerCount, options) {
    // V1版本：基于PRD中的标准配置表
    // 在后续任务中将由GameTemplates类提供
    const template = GameTemplates.getRandomTemplate(playerCount);
    if (template) {
      return template;
    }

    // 处理超出范围的情况
    const extendedTemplate = GameTemplates.getNearestTemplate(playerCount);
    if (extendedTemplate.template) {
      return extendedTemplate.template;
    }
    
    throw new Error(`不支持${playerCount}人的游戏配置`);
  }
  
  /**
   * 检查配置是否最近使用过
   * @private
   * @param {Array<string>} config - 角色配置
   * @returns {boolean} 是否最近使用过
   */
  static _isRecentlyUsed(config) {
    if (!config) return false;
    
    const configStr = [...config].sort().join(',');
    return RoleConfigurator.recentConfigs.some(c => [...c].sort().join(',') === configStr);
  }
  
  /**
   * 记录配置到历史记录
   * @private
   * @param {Array<string>} config - 角色配置
   */
  static _recordConfig(config) {
    if (!config) return;
    
    RoleConfigurator.recentConfigs.unshift([...config]);
    
    // 限制历史记录长度
    if (RoleConfigurator.recentConfigs.length > RoleConfigurator.MAX_HISTORY_LENGTH) {
      RoleConfigurator.recentConfigs.pop();
    }
  }
  
  /**
   * 生成配置变化
   * 在保持总人数和基本平衡的前提下，对配置进行小变化
   * @private
   * @param {Array<string>} baseConfig - 基础配置
   * @param {number} playerCount - 玩家人数
   * @returns {Array<string>} 变化后的配置
   */
  static _generateVariation(baseConfig, playerCount) {
    // 简单实现：在一定条件下替换特殊角色
    // 在后续任务中将会实现更复杂的变化逻辑
    const config = [...baseConfig];
    
    // 尝试替换一些角色
    if (playerCount >= 8 && Math.random() > 0.5) {
      const availableRoles = RoleData.getAvailableRoles(playerCount);
      const godRoles = availableRoles.filter(role => RoleData.isGod(role));
      
      // 有概率替换女巫为猎人，或猎人为女巫
      for (let i = 0; i < config.length; i++) {
        if (config[i] === "WITCH" && Math.random() > 0.7 && godRoles.includes("HUNTER")) {
          config[i] = "HUNTER";
          break;
        } else if (config[i] === "HUNTER" && Math.random() > 0.7 && godRoles.includes("WITCH")) {
          config[i] = "WITCH";
          break;
        }
      }
    }
    
    return config;
  }
  
  /**
   * 生成平衡的配置
   * 在验证失败时使用此方法尝试生成平衡配置
   * @private
   * @param {number} playerCount - 玩家人数
   * @returns {Array<string>} 平衡的角色配置
   */
  static _generateBalancedConfig(playerCount) {
    // 基于平方根法则确定狼人数量
    const wolfCount = Math.floor(Math.sqrt(playerCount));
    
    const availableRoles = RoleData.getAvailableRoles(playerCount);
    const godRoles = availableRoles.filter(role => RoleData.isGod(role));
    
    // 确定神民数量 - 根据PRD解锁规则
    let godCount = godRoles.length;
    
    // 确定村民数量
    const villagerCount = playerCount - wolfCount - godCount;
    
    // 构建配置
    const config = [];
    
    // 添加狼人
    for (let i = 0; i < wolfCount; i++) {
      config.push("WOLF");
    }
    
    // 添加神民
    for (const role of godRoles) {
      config.push(role);
    }
    
    // 添加村民
    for (let i = 0; i < villagerCount; i++) {
      config.push("VILLAGER");
    }
    
    return config;
  }
  
  /**
   * 生成备选配置
   * 当配置生成失败时的回退机制
   * @private
   * @param {number} playerCount - 玩家人数
   * @returns {Array<string>} 备选角色配置
   */
  static _generateFallbackConfig(playerCount) {
    console.warn(`为 ${playerCount} 人游戏生成回退配置`);
    
    // 基于平方根法则确定狼人数量
    const wolfCount = Math.floor(Math.sqrt(playerCount));
    
    // 剩余的都是村民
    const villagerCount = playerCount - wolfCount;
    
    const config = [];
    for (let i = 0; i < wolfCount; i++) {
      config.push("WOLF");
    }
    for (let i = 0; i < villagerCount; i++) {
      config.push("VILLAGER");
    }
    
    return config;
  }
} 