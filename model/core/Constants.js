/**
 * @description 游戏核心常量统一定义
 * 所有常量的单一数据源，避免重复定义
 */

// ==================== 角色相关常量 ====================

/**
 * 游戏角色枚举
 * 统一的角色标识符，所有模块都应使用此定义
 */
export const ROLES = {
  WOLF: 'WOLF',
  PROPHET: 'PROPHET',
  WITCH: 'WITCH',
  HUNTER: 'HUNTER',
  GUARD: 'GUARD',
  VILLAGER: 'VILLAGER'
}

/**
 * 阵营枚举
 * 统一的阵营标识符，与角色系统保持一致
 */
export const CAMPS = {
  WOLF: 'WOLF', // 狼人阵营
  GOD: 'GOD', // 神民阵营
  VILLAGER: 'VILLAGER' // 村民阵营
}

/**
 * 角色权重映射
 * 好人阵营（村民、神民）权重为正数，狼人阵营权重为负数
 * 权重绝对值越大表示对平衡的影响越大
 */
export const ROLE_WEIGHTS = {
  [ROLES.WOLF]: -8, // 狼人：负面权重
  [ROLES.VILLAGER]: 1, // 村民：基础正面权重
  [ROLES.PROPHET]: 7, // 预言家：高正面权重
  [ROLES.WITCH]: 4, // 女巫：中高正面权重
  [ROLES.HUNTER]: 3, // 猎人：中等正面权重
  [ROLES.GUARD]: 3 // 守卫：中等正面权重
}

/**
 * 角色阵营映射
 * 确保与角色定义保持一致
 */
export const ROLE_CAMPS = {
  [ROLES.WOLF]: CAMPS.WOLF, // 狼人阵营
  [ROLES.VILLAGER]: CAMPS.VILLAGER, // 村民阵营
  [ROLES.PROPHET]: CAMPS.GOD, // 神民阵营
  [ROLES.WITCH]: CAMPS.GOD, // 神民阵营
  [ROLES.HUNTER]: CAMPS.GOD, // 神民阵营
  [ROLES.GUARD]: CAMPS.GOD // 神民阵营
}

/**
 * 角色中文名称映射
 * 用于显示用户友好的中文角色名称
 */
export const ROLE_NAMES_CN = {
  [ROLES.WOLF]: '狼人',
  [ROLES.PROPHET]: '预言家',
  [ROLES.WITCH]: '女巫',
  [ROLES.HUNTER]: '猎人',
  [ROLES.GUARD]: '守卫',
  [ROLES.VILLAGER]: '村民'
}

// ==================== 游戏行动常量 ====================

/**
 * 游戏行动枚举
 * 统一的行动标识符
 */
export const ACTIONS = {
  VOTE: 'vote',
  ABSTAIN: 'abstain',
  SKIP: 'skip',
  REGISTER: 'register',
  TRANSFER: 'transfer',
  GIVEUP: 'giveup',
  SUPPORT: 'support',
  END_SPEECH: 'endSpeech',
  PROTECT: 'protect',
  CHECK: 'check',
  POISON: 'poison',
  SAVE: 'save',
  KILL: 'kill',
  SUICIDE: 'suicide'
}

// ==================== 游戏状态常量 ====================

/**
 * 游戏阶段枚举
 */
export const GAME_PHASES = {
  WAITING: 'waiting', // 等待玩家
  STARTING: 'starting', // 游戏开始
  SHERIFF_ELECTION: 'sheriff_election', // 警长竞选
  DAY_DISCUSSION: 'day_discussion', // 白天讨论
  DAY_VOTING: 'day_voting', // 白天投票
  NIGHT: 'night', // 夜晚
  GAME_END: 'game_end' // 游戏结束
}

/**
 * 玩家状态枚举
 */
export const PLAYER_STATES = {
  ALIVE: 'alive', // 存活
  DEAD: 'dead', // 死亡
  SPECTATOR: 'spectator' // 观战
}

/**
 * 死亡原因枚举
 */
export const DEATH_REASONS = {
  WOLF_KILL: 'WOLF_KILL', // 被狼人杀死
  EXILE: 'EXILE', // 被放逐出村
  POISON: 'POISON', // 中毒身亡
  HUNTER_SHOT: 'HUNTER_SHOT' // 被猎人射杀
}

// ==================== 配置键名常量 ====================

/**
 * 配置文件键名枚举
 * 统一管理所有配置键名，避免硬编码字符串
 */
export const CONFIG_KEYS = {
  // 游戏基础配置
  MIN_PLAYERS: 'minPlayers',
  MAX_PLAYERS: 'maxPlayers',
  SPEAK_TIME_LIMIT: 'speakTimeLimit',
  VOTE_TIME_LIMIT: 'voteTimeLimit',
  LAST_WORDS_TIME_LIMIT: 'lastWordsTimeLimit',
  SHERIFF_SPEECH_TIME: 'sheriffSpeechTime',
  MIN_VOTES_TO_KILL: 'minVotesToKill',
  ENABLE_TUBIAN: 'enableTubian',
  SHERIFF: 'sheriff',

  // 角色配置
  ROLES_CONFIG: 'roles',
  MODES_CONFIG: 'modes',
  BALANCE_CONFIG: 'balance',

  // 系统配置
  DEBUG_MODE: 'debugMode',
  LOG_LEVEL: 'logLevel',
  AUTO_SAVE: 'autoSave'
}

// ==================== 消息类型常量 ====================

/**
 * 消息类型枚举
 */
export const MESSAGE_TYPES = {
  GROUP: 'group', // 群消息
  PRIVATE: 'private' // 私聊消息
}

// ==================== 平衡性验证常量 ====================

/**
 * 平衡性验证阈值
 */
export const BALANCE_THRESHOLDS = {
  EVIL_RATIO_MIN: 0.4, // 邪恶阵营最小比例
  EVIL_RATIO_MAX: 0.6, // 邪恶阵营最大比例
  WOLF_RATIO_MIN: 0.15, // 狼人最小比例
  WOLF_RATIO_MAX: 0.35 // 狼人最大比例
}

// ==================== 夜晚阶段配置常量 ====================

/**
 * 夜晚阶段配置
 * 定义夜晚三个核心阶段的配置信息，支持阶段化状态机架构
 *
 * {{CHENGQI: Action: Added; Timestamp: 2025-06-19 19:38:09 +08:00; Reason: Shrimp Task ID: #730b5db2-7e1d-4704-9ed2-2c90c912ee1f, 创建夜晚阶段配置系统基础常量; Principle_Applied: SOLID-SRP-SingleResponsibility;}}
 */
export const NIGHT_PHASE_CONFIG = {
  /**
   * 信息收集阶段
   * 预言家查验和守卫保护的并行执行阶段
   */
  INFORMATION: {
    name: 'information',
    description: '信息收集阶段 - 预言家查验与守卫保护',
    roles: [ROLES.PROPHET, ROLES.GUARD],
    allowParallel: true, // 支持并行处理
    timeout: 60000, // 60秒超时
    order: 1, // 执行顺序
    requiredActions: {
      [ROLES.PROPHET]: [ACTIONS.CHECK, ACTIONS.SKIP],
      [ROLES.GUARD]: [ACTIONS.PROTECT, ACTIONS.SKIP]
    }
  },

  /**
   * 消除阶段
   * 狼人讨论和击杀的协作执行阶段
   */
  ELIMINATION: {
    name: 'elimination',
    description: '消除阶段 - 狼人讨论与击杀',
    roles: [ROLES.WOLF],
    allowParallel: false, // 狼人需要协作，不支持完全并行
    timeout: 120000, // 120秒超时（包含讨论时间）
    order: 2, // 执行顺序
    requiredActions: {
      [ROLES.WOLF]: [ACTIONS.KILL, ACTIONS.SKIP, ACTIONS.SUICIDE]
    },
    discussionTime: 60000, // 狼人讨论时间
    votingTime: 60000 // 狼人投票时间
  },

  /**
   * 干预阶段
   * 女巫毒药和解药使用的顺序执行阶段
   */
  INTERVENTION: {
    name: 'intervention',
    description: '干预阶段 - 女巫毒药与解药使用',
    roles: [ROLES.WITCH],
    allowParallel: false, // 女巫行动需要顺序执行
    timeout: 60000, // 60秒超时
    order: 3, // 执行顺序
    requiredActions: {
      [ROLES.WITCH]: [ACTIONS.POISON, ACTIONS.SAVE, ACTIONS.SKIP]
    },
    subPhases: {
      SAVE_PHASE: {
        name: 'save',
        description: '解药使用阶段',
        timeout: 30000,
        actions: [ACTIONS.SAVE, ACTIONS.SKIP]
      },
      POISON_PHASE: {
        name: 'poison',
        description: '毒药使用阶段',
        timeout: 30000,
        actions: [ACTIONS.POISON, ACTIONS.SKIP]
      }
    }
  }
}

/**
 * 夜晚阶段执行顺序
 * 定义阶段的标准执行顺序
 */
export const NIGHT_PHASE_ORDER = [
  NIGHT_PHASE_CONFIG.INFORMATION,
  NIGHT_PHASE_CONFIG.ELIMINATION,
  NIGHT_PHASE_CONFIG.INTERVENTION
]

/**
 * 夜晚阶段状态枚举
 * 用于状态机中的阶段状态标识
 */
export const NIGHT_PHASE_STATES = {
  INFORMATION_PHASE: 'InformationPhaseState',
  ELIMINATION_PHASE: 'EliminationPhaseState',
  INTERVENTION_PHASE: 'InterventionPhaseState'
}
