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
