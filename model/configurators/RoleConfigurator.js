/**
 * 角色配置生成器
 * 基于PRD中的权重平衡系统，为不同人数的游戏动态生成或选择平衡、合理的角色配置
 */
import { GameTemplates } from './GameTemplates.js';
import { RoleData } from './RoleData.js';
import { BalanceValidator } from './BalanceValidator.js';

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
      // 1. 尝试从模板获取配置
      let config = GameTemplates.getRandomTemplate(playerCount);
      let validation = config ? BalanceValidator.validate(config) : { isValid: false };
      
      // 2. 如果模板无效或不存在，则程序化生成
      if (!validation.isValid) {
        if (config) {
          console.warn(`[配置警告] ${playerCount}人模板'${GameTemplates.getTemplateMetadata(playerCount)?.name}'不平衡: ${validation.reason}`);
        }
        config = RoleConfigurator._generateProceduralConfig(playerCount);
        validation = BalanceValidator.validate(config);
        
        // 如果程序化生成的配置仍然无效，抛出错误
        if (!validation.isValid) {
          throw new Error(`无法为${playerCount}人生成平衡的程序化配置: ${validation.reason}`);
        }
      }
      
      // 3. 记录并返回最终配置
      RoleConfigurator._recordConfig(config);
      return config;
      
    } catch (error) {
      console.error(`角色配置生成失败: ${error.message}`);
      // 最终回退机制：一个绝对安全的极简配置
      const wolfCount = Math.max(1, Math.floor(playerCount / 4));
      const villagers = Array(playerCount - wolfCount).fill('VILLAGER');
      const wolves = Array(wolfCount).fill('WOLF');
      return [...wolves, ...villagers];
    }
  }
  
  /**
   * 统一的程序化配置生成器
   * @private
   */
  static _generateProceduralConfig(playerCount) {
    // 基于平方根法则确定狼人数量
    const wolfCount = Math.floor(Math.sqrt(playerCount));
    
    // 获取当前人数可用的神民角色
    const availableGods = RoleData.getRolesByCamp('GOD').filter(
      role => RoleData.getUnlockCount(role) <= playerCount
    );
    
    // 动态确定神民数量，例如总人数的1/4
    const godCount = Math.min(availableGods.length, Math.floor(playerCount / 4));
    
    // 确定村民数量
    const villagerCount = playerCount - wolfCount - godCount;
    
    // 构建配置
    const config = [];
    
    // 添加狼人
    for (let i = 0; i < wolfCount; i++) {
      config.push("WOLF");
    }
    
    // 添加神民 (随机选择)
    const selectedGods = [];
    while(selectedGods.length < godCount && availableGods.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableGods.length);
      selectedGods.push(availableGods.splice(randomIndex, 1)[0]);
    }
    config.push(...selectedGods);
    
    // 添加村民
    for (let i = 0; i < villagerCount; i++) {
      config.push("VILLAGER");
    }
    
    return config;
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
} 