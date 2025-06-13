/**
 * 游戏标准配置模板管理模块
 * 基于PRD中的标准配置表，为不同人数的游戏提供预定义的角色配置模板
 * 遵循平方根法则、权重平衡系统和约束驱动生成的三大核心算法原则
 */
import { RoleData } from './RoleData.js';

export class GameTemplates {
  /**
   * 标准配置模板
   * 基于PRD中定义的标准配置表，为6-12人游戏提供标准角色配置
   * 确保每个配置满足平衡度要求
   */
  static standardTemplates = {
    6: ["WOLF", "WOLF", "PROPHET", "WITCH", "VILLAGER", "VILLAGER"],
    7: ["WOLF", "WOLF", "PROPHET", "WITCH", "VILLAGER", "VILLAGER", "VILLAGER"],
    8: ["WOLF", "WOLF", "PROPHET", "WITCH", "HUNTER", "VILLAGER", "VILLAGER", "VILLAGER"],
    9: ["WOLF", "WOLF", "PROPHET", "WITCH", "HUNTER", "GUARD", "VILLAGER", "VILLAGER", "VILLAGER"],
    10: ["WOLF", "WOLF", "WOLF", "PROPHET", "WITCH", "HUNTER", "GUARD", "VILLAGER", "VILLAGER", "VILLAGER"],
    11: ["WOLF", "WOLF", "WOLF", "PROPHET", "WITCH", "HUNTER", "GUARD", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"],
    12: ["WOLF", "WOLF", "WOLF", "WOLF", "PROPHET", "WITCH", "HUNTER", "GUARD", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]
  };
  
  /**
   * 模板变种配置
   * 为每个标准人数提供一些变体配置，增加游戏多样性
   * 每个变体都确保符合平衡度要求
   */
  static templateVariations = {
    // 8人变种：替换女巫为猎人
    8: [
      ["WOLF", "WOLF", "PROPHET", "HUNTER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]
    ],
    // 9人变种：替换守卫为女巫增强
    9: [
      ["WOLF", "WOLF", "PROPHET", "WITCH", "WITCH", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]
    ],
    // 10人变种：不同的神民组合
    10: [
      ["WOLF", "WOLF", "WOLF", "PROPHET", "WITCH", "HUNTER", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"],
      ["WOLF", "WOLF", "WOLF", "PROPHET", "GUARD", "GUARD", "VILLAGER", "VILLAGER", "VILLAGER", "VILLAGER"]
    ]
  };
  
  /**
   * 模板元数据
   * 存储每个模板的额外信息，如平衡度评分、推荐人数等
   */
  static templateMetadata = {
    6: { balance: "良好", recommendedFor: "入门游戏", difficulty: "简单" },
    7: { balance: "良好", recommendedFor: "入门游戏", difficulty: "简单" },
    8: { balance: "优秀", recommendedFor: "标准游戏", difficulty: "中等" },
    9: { balance: "优秀", recommendedFor: "标准游戏", difficulty: "中等" },
    10: { balance: "优秀", recommendedFor: "进阶游戏", difficulty: "中等" },
    11: { balance: "良好", recommendedFor: "进阶游戏", difficulty: "困难" },
    12: { balance: "良好", recommendedFor: "高级游戏", difficulty: "困难" }
  };
  
  /**
   * 获取指定人数的标准配置模板
   * @param {number} playerCount - 玩家人数
   * @returns {Array<string>|null} 角色配置数组或null（如果没有匹配的模板）
   */
  static getTemplate(playerCount) {
    if (!Number.isInteger(playerCount)) {
      console.warn("玩家人数必须是整数");
      return null;
    }
    
    const template = GameTemplates.standardTemplates[playerCount];
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
    return Object.keys(GameTemplates.standardTemplates).map(Number).sort((a, b) => a - b);
  }
  
  /**
   * 获取指定人数的模板变种
   * @param {number} playerCount - 玩家人数
   * @returns {Array<Array<string>>} 该人数下的模板变种数组（如果没有变种，则返回空数组）
   */
  static getTemplateVariations(playerCount) {
    if (!Number.isInteger(playerCount)) {
      return [];
    }
    
    const variations = GameTemplates.templateVariations[playerCount] || [];
    // 返回变种的深拷贝
    return variations.map(variation => [...variation]);
  }
  
  /**
   * 随机获取指定人数的一个配置（可能是标准配置或其变种）
   * @param {number} playerCount - 玩家人数
   * @returns {Array<string>|null} 角色配置数组或null（如果没有匹配的模板）
   */
  static getRandomTemplate(playerCount) {
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
   * 验证配置是否平衡
   * 基于PRD中的游戏平衡验证指标进行验证
   * @param {Array<string>} template - 角色配置
   * @returns {Object} 包含验证结果的对象 
   */
  static validateTemplate(template) {
    if (!template || !Array.isArray(template) || template.length === 0) {
      return { 
        isValid: false, 
        reason: "无效的配置模板" 
      };
    }
    
    const playerCount = template.length;
    
    // 计算阵营力量
    let goodPower = 0;
    let evilPower = 0;
    let wolfCount = 0;
    
    for (const role of template) {
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
    
    // 计算阵营力量比
    const totalPower = goodPower + evilPower;
    if (totalPower === 0) {
      return { 
        isValid: false, 
        reason: "总权重为零，无法计算平衡性" 
      };
    }
    
    const evilRatio = evilPower / totalPower;
    
    // 计算狼人比例
    const wolfRatio = wolfCount / playerCount;
    
    // 验证阵营力量比（应在0.4-0.6之间）
    if (evilRatio < 0.4 || evilRatio > 0.6) {
      return { 
        isValid: false, 
        reason: `阵营力量比不平衡: ${evilRatio.toFixed(2)}，应在0.4-0.6之间`,
        evilRatio,
        wolfRatio,
        goodPower,
        evilPower
      };
    }
    
    // 验证狼人比例（应在15%-35%之间）
    if (wolfRatio < 0.15 || wolfRatio > 0.35) {
      return { 
        isValid: false, 
        reason: `狼人比例不合理: ${(wolfRatio * 100).toFixed(0)}%，应在15%-35%之间`,
        evilRatio,
        wolfRatio,
        goodPower,
        evilPower
      };
    }
    
    // 验证特殊角色是否符合解锁规则
    for (const role of template) {
      const minCount = RoleData.getUnlockCount(role);
      if (playerCount < minCount) {
        return { 
          isValid: false, 
          reason: `角色${role}需要至少${minCount}名玩家才能解锁`,
          evilRatio,
          wolfRatio,
          goodPower,
          evilPower
        };
      }
    }
    
    return { 
      isValid: true, 
      evilRatio,
      wolfRatio,
      goodPower,
      evilPower,
      balance: evilRatio > 0.45 && evilRatio < 0.55 ? "优秀" : "良好"
    };
  }
  
  /**
   * 获取模板的元数据信息
   * @param {number} playerCount - 玩家人数
   * @returns {Object|null} 模板元数据或null（如果没有匹配的模板）
   */
  static getTemplateMetadata(playerCount) {
    if (!Number.isInteger(playerCount)) {
      return null;
    }
    
    return GameTemplates.templateMetadata[playerCount] || null;
  }
  
  /**
   * 计算配置的平衡度评分
   * @param {Array<string>} template - 角色配置
   * @returns {number} 平衡度评分（0-100，越高越平衡）
   */
  static calculateBalanceScore(template) {
    const validation = GameTemplates.validateTemplate(template);
    if (!validation.isValid) {
      return 0;
    }
    
    // 理想的阵营力量比为0.5，与此的接近程度决定评分
    const balanceDeviation = Math.abs(validation.evilRatio - 0.5);
    // 理想的狼人比例为0.25，与此的接近程度也影响评分
    const wolfRatioDeviation = Math.abs(validation.wolfRatio - 0.25);
    
    // 根据偏差计算评分，偏差越小，评分越高
    const balanceScore = 100 - balanceDeviation * 200; // 最大偏差0.5，扣100分
    const wolfRatioScore = 100 - wolfRatioDeviation * 500; // 最大偏差0.2，扣100分
    
    // 综合评分，平衡性占60%，狼人比例占40%
    return Math.round(balanceScore * 0.6 + wolfRatioScore * 0.4);
  }
} 