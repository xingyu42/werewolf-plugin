/**
 * 游戏标准配置模板管理模块 * 
 * 主要功能：
 * - 从modes.yaml加载角色模板，支持自定义和扩展
 * - 配置驱动角色分配机制，所有角色模板均可通过编辑modes.yaml实现
 * - 提供配置缓存机制，提高性能
 * 
 * 
 * 遵循平方根法则、权重平衡系统和约束驱动生成的三大核心算法原则
 */
import GameConfig from '../../components/GameConfig.js';
import { BalanceValidator } from './BalanceValidator.js';

export class GameTemplates {
  // 配置缓存，避免重复读取配置文件
  static _configCache = null;
  

  
  /**
   * 从配置中加载游戏模板
   * presets键值对 (推荐)
   * @private
   */
  static _loadTemplates() {
    // 防止重复加载
    if (GameTemplates._configCache !== null) {
      return;
    }
    
    // 初始化缓存
    GameTemplates._configCache = {
      templates: {},     // 标准模板
      variations: {},    // 模板变种
      metadata: {}       // 模板元数据
    };

    try {
      // 获取modes配置
      const modesConfig = GameConfig.modes;
      
      // 处理新格式的预设配置
      if (modesConfig && modesConfig.presets) {
        // 遍历所有预设，转换为数组形式
        for (const [playerCount, preset] of Object.entries(modesConfig.presets)) {
          const count = parseInt(playerCount, 10);
          if (isNaN(count) || !preset || !preset.roles) continue;
          
          // 转换键值对格式为数组列表
          const roleList = [];
          for (const [role, number] of Object.entries(preset.roles)) {
            for (let i = 0; i < number; i++) {
              roleList.push(role);
            }
          }
          
          // 保存到缓存
          GameTemplates._configCache.templates[count] = roleList;
          
          // 保存元数据
          GameTemplates._configCache.metadata[count] = {
            name: preset.name || `${count}人标准局`,
            description: preset.description || "",
            balance: "标准"
          };
        }
      }
            
      // 处理变种配置 (如果存在)
      if (modesConfig && modesConfig.variations) {
        for (const [playerCount, variationList] of Object.entries(modesConfig.variations)) {
          const count = parseInt(playerCount, 10);
          if (isNaN(count) || !Array.isArray(variationList)) continue;
          
          GameTemplates._configCache.variations[count] = variationList.map(variation => {
            // 如果变种是键值对格式，转换为数组
            if (variation.roles) {
              const roleList = [];
              for (const [role, number] of Object.entries(variation.roles)) {
                for (let i = 0; i < number; i++) {
                  roleList.push(role);
                }
              }
              return roleList;
            }
            // 如果已经是数组格式，直接使用
            return [...variation];
          });
        }
      }

      // (推荐) 对所有加载的模板进行一次性平衡性检查
      for (const [playerCount, template] of Object.entries(GameTemplates._configCache.templates)) {
        const validation = BalanceValidator.validate(template);
        if (!validation.isValid) {
          console.warn(`[模板警告] ${playerCount}人预设模板不平衡: ${validation.reason}`);
        }
      }
            
      console.log("游戏模板配置加载完成");
    } catch (error) {
      console.error("加载游戏模板配置失败:", error);
      // 使用硬编码的标准模板作为回退
    }
  }
  

  
  /**
   * 获取指定人数的标准配置模板
   * 从配置缓存中获取，如果缓存不存在则先加载配置
   * @param {number} playerCount - 玩家人数
   * @returns {Array<string>|null} 角色配置数组或null（如果没有匹配的模板）
   */
  static getTemplate(playerCount) {
    // 确保模板已加载
    GameTemplates._loadTemplates();
    
    if (!Number.isInteger(playerCount)) {
      console.warn("玩家人数必须是整数");
      return null;
    }
    
    const template = GameTemplates._configCache.templates[playerCount];
    if (!template) {
      return null;
    }
    
    // 返回模板的副本，避免外部修改
    return [...template];
  }
  
  /**
   * 获取所有可用的标准模板人数
   * @returns {Array<number>} 支持的玩家人数数组
   */
  static getAvailablePlayerCounts() {
    // 确保模板已加载
    GameTemplates._loadTemplates();
    return Object.keys(GameTemplates._configCache.templates).map(Number).sort((a, b) => a - b);
  }
  
  /**
   * 获取指定人数的模板变种
   * @param {number} playerCount - 玩家人数
   * @returns {Array<Array<string>>} 该人数下的模板变种数组（如果没有变种，则返回空数组）
   */
  static getTemplateVariations(playerCount) {
    // 确保模板已加载
    GameTemplates._loadTemplates();
    
    if (!Number.isInteger(playerCount)) {
      return [];
    }
    
    const variations = GameTemplates._configCache.variations[playerCount] || [];
    // 返回变种的深拷贝
    return variations.map(variation => [...variation]);
  }
  
  /**
   * 随机获取指定人数的一个配置（可能是标准配置或其变种）
   * @param {number} playerCount - 玩家人数
   * @returns {Array<string>|null} 角色配置数组或null（如果没有匹配的模板）
   */
  static getRandomTemplate(playerCount) {
    // 确保模板已加载
    GameTemplates._loadTemplates();
    
    const standardTemplate = GameTemplates.getTemplate(playerCount);
    if (!standardTemplate) {
      return null;
    }
    
    const variations = GameTemplates.getTemplateVariations(playerCount);
    if (variations.length === 0) {
      return standardTemplate;
    }
    
    // 将标准模板和变种合并，然后随机选择一个
    const allTemplates = [standardTemplate, ...variations];
    const randomIndex = Math.floor(Math.random() * allTemplates.length);
    
    return allTemplates[randomIndex];
  }
  
  /**
   * 获取最接近的模板（用于处理非标准人数）
   * 策略：选择不超过目标人数的最大支持人数
   * @param {number} playerCount - 玩家人数
   * @returns {Object} 包含template和actualCount的对象
   */
  static getNearestTemplate(playerCount) {
    // 确保模板已加载
    GameTemplates._loadTemplates();
    
    if (!Number.isInteger(playerCount) || playerCount < 6) {
      return { template: null, actualCount: 0 };
    }
    
    // 获取所有可用的标准模板人数
    const availableCounts = GameTemplates.getAvailablePlayerCounts();
    
    // 寻找不超过目标人数的最大支持人数
    let nearestCount = 0;
    for (const count of availableCounts) {
      if (count <= playerCount && count > nearestCount) {
        nearestCount = count;
      }
    }
    
    // 对于超出支持范围的人数，使用基于最大支持人数的扩展逻辑
    if (playerCount > Math.max(...availableCounts)) {
      return GameTemplates._generateExtendedTemplate(playerCount);
    }
    
    return {
      template: GameTemplates.getTemplate(nearestCount),
      actualCount: nearestCount
    };
  }
  
  /**
   * 生成扩展模板（用于处理超出标准范围的人数）
   * 基于平方根法则和权重平衡原则设计
   * @private
   * @param {number} playerCount - 玩家人数
   * @returns {Object} 包含template和actualCount的对象
   */
  static _generateExtendedTemplate(playerCount) {
    // 最大支持的标准人数
    const maxStandardCount = Math.max(...GameTemplates.getAvailablePlayerCounts());
    const baseTemplate = GameTemplates.getTemplate(maxStandardCount);
    
    if (!baseTemplate) {
      return { template: null, actualCount: 0 };
    }
    
    // 计算需要额外添加的玩家数
    const additionalCount = playerCount - maxStandardCount;
    if (additionalCount <= 0) {
      return { template: baseTemplate, actualCount: maxStandardCount };
    }
    
    // 基于平方根法则计算额外狼人数量
    const baseWolfCount = baseTemplate.filter(role => role === "WOLF").length;
    const targetWolfCount = Math.floor(Math.sqrt(playerCount));
    const additionalWolves = Math.max(0, targetWolfCount - baseWolfCount);
    
    // 剩余添加为村民
    const additionalVillagers = additionalCount - additionalWolves;
    
    // 构建扩展模板
    const extendedTemplate = [...baseTemplate];
    
    // 添加额外的狼人
    for (let i = 0; i < additionalWolves; i++) {
      extendedTemplate.push("WOLF");
    }
    
    // 添加额外的村民
    for (let i = 0; i < additionalVillagers; i++) {
      extendedTemplate.push("VILLAGER");
    }
    
    return {
      template: extendedTemplate,
      actualCount: playerCount
    };
  }
  
  /**
   * 获取模板元数据
   * 包含名称、描述、平衡度等信息
   * @param {number} playerCount - 玩家人数
   * @returns {Object|null} 模板元数据或null
   */
  static getTemplateMetadata(playerCount) {
    // 确保模板已加载
    GameTemplates._loadTemplates();
    
    if (!Number.isInteger(playerCount)) {
      return null;
    }
    
    return GameTemplates._configCache.metadata[playerCount] || null;
  }
}