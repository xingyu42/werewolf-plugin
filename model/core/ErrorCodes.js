/**
 * 统一错误代码枚举
 * 定义所有游戏相关的错误代码和分类
 */

/**
 * 错误严重级别
 */
export const ErrorSeverity = {
  LOW: 'low', // 低级别：用户操作错误，不影响系统
  MEDIUM: 'medium', // 中级别：业务逻辑错误，影响当前操作
  HIGH: 'high', // 高级别：系统错误，影响游戏进行
  CRITICAL: 'critical' // 严重级别：致命错误，需要立即处理
}

/**
 * 错误分类
 */
export const ErrorCategory = {
  VALIDATION: 'validation', // 验证错误
  GAME_LOGIC: 'game_logic', // 游戏逻辑错误
  SYSTEM: 'system', // 系统错误
  NETWORK: 'network', // 网络错误
  RESOURCE: 'resource', // 资源错误
  PERMISSION: 'permission' // 权限错误
}

/**
 * 统一错误代码定义
 */
export const ErrorCodes = {
  // 通用错误 (1000-1099)
  UNKNOWN_ERROR: {
    code: 'E1000',
    message: '未知错误',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.SYSTEM
  },
  INVALID_PARAMETER: {
    code: 'E1001',
    message: '参数无效',
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.VALIDATION
  },
  NULL_REFERENCE: {
    code: 'E1002',
    message: '空引用错误',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.SYSTEM
  },

  // 玩家相关错误 (1100-1199)
  INVALID_PLAYER: {
    code: 'E1100',
    message: '无效的玩家操作',
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.VALIDATION
  },
  PLAYER_NOT_FOUND: {
    code: 'E1101',
    message: '玩家不存在',
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.VALIDATION
  },
  INSUFFICIENT_PLAYERS: {
    code: 'E1102',
    message: '游戏人数不足',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.VALIDATION
  },
  FRIEND_STATUS_CHECK_FAILED: {
    code: 'E1103',
    message: '部分玩家未添加机器人好友',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.VALIDATION
  },
  GAME_STATE_ABNORMAL: {
    code: 'E1104',
    message: '游戏状态异常',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.GAME_LOGIC
  },
  PLAYER_ALREADY_EXISTS: {
    code: 'E1105',
    message: '玩家已存在',
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.VALIDATION
  },
  PLAYER_NOT_ALIVE: {
    code: 'E1106',
    message: '玩家已死亡',
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.GAME_LOGIC
  },
  PLAYER_DEATH_ERROR: {
    code: 'E1107',
    message: '处理玩家死亡时出错',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.GAME_LOGIC
  },

  // 游戏状态错误 (1200-1299)
  INVALID_ACTION: {
    code: 'E1200',
    message: '当前阶段无法执行该操作',
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.GAME_LOGIC
  },
  NO_ACTIVE_STATE: {
    code: 'E1201',
    message: '游戏尚未开始或已结束',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.GAME_LOGIC
  },
  STATE_TRANSITION_ERROR: {
    code: 'E1202',
    message: '游戏状态转换错误',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.GAME_LOGIC
  },
  INVALID_GAME_STATE: {
    code: 'E1203',
    message: '游戏状态无效',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.GAME_LOGIC
  },

  // 投票相关错误 (1300-1399)
  VOTE_ERROR: {
    code: 'E1300',
    message: '投票操作失败',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.GAME_LOGIC
  },
  INVALID_VOTE_TARGET: {
    code: 'E1301',
    message: '投票目标无效',
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.VALIDATION
  },
  VOTE_ALREADY_CAST: {
    code: 'E1302',
    message: '已经投过票了',
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.GAME_LOGIC
  },

  // 警长相关错误 (1400-1499)
  SHERIFF_ELECT_ERROR: {
    code: 'E1400',
    message: '警长竞选操作失败',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.GAME_LOGIC
  },
  SHERIFF_TRANSFER_ERROR: {
    code: 'E1401',
    message: '警长移交失败',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.GAME_LOGIC
  },
  NOT_SHERIFF: {
    code: 'E1402',
    message: '你不是警长',
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.PERMISSION
  },

  // 角色行动错误 (1500-1599)
  GUARD_ACTION_ERROR: {
    code: 'E1500',
    message: '守卫行动失败',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.GAME_LOGIC
  },
  PROPHET_ACTION_ERROR: {
    code: 'E1501',
    message: '预言家行动失败',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.GAME_LOGIC
  },
  WITCH_POISON_ERROR: {
    code: 'E1502',
    message: '女巫毒药使用失败',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.GAME_LOGIC
  },
  WITCH_SAVE_ERROR: {
    code: 'E1503',
    message: '女巫解药使用失败',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.GAME_LOGIC
  },
  HUNTER_SHOOT_ERROR: {
    code: 'E1504',
    message: '猎人开枪失败',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.GAME_LOGIC
  },
  WOLF_ACTION_ERROR: {
    code: 'E1505',
    message: '狼人行动失败',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.GAME_LOGIC
  },

  // 系统资源错误 (1600-1699)
  BROWSER_INIT_ERROR: {
    code: 'E1600',
    message: '浏览器初始化失败',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.RESOURCE
  },
  MODULE_LOAD_ERROR: {
    code: 'E1601',
    message: '模块加载失败',
    severity: ErrorSeverity.CRITICAL,
    category: ErrorCategory.SYSTEM
  },
  CONFIG_LOAD_ERROR: {
    code: 'E1602',
    message: '配置加载失败',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.SYSTEM
  },
  MEMORY_LEAK_WARNING: {
    code: 'E1603',
    message: '检测到内存泄漏风险',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.RESOURCE
  },

  // 网络和通信错误 (1700-1799)
  NETWORK_ERROR: {
    code: 'E1700',
    message: '网络连接错误',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.NETWORK
  },
  MESSAGE_SEND_ERROR: {
    code: 'E1701',
    message: '消息发送失败',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.NETWORK
  },

  // 权限和安全错误 (1800-1899)
  PERMISSION_DENIED: {
    code: 'E1800',
    message: '权限不足',
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.PERMISSION
  },
  UNAUTHORIZED_ACTION: {
    code: 'E1801',
    message: '未授权的操作',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.PERMISSION
  }
}

/**
 * 根据错误代码获取错误信息
 * @param {string} errorCode 错误代码
 * @returns {Object|null} 错误信息对象
 */
export function getErrorInfo (errorCode) {
  for (const value of Object.values(ErrorCodes)) {
    if (value.code === errorCode) {
      return value
    }
  }
  return null
}

/**
 * 根据错误名称获取错误信息
 * @param {string} errorName 错误名称
 * @returns {Object|null} 错误信息对象
 */
export function getErrorByName (errorName) {
  return ErrorCodes[errorName] || null
}

/**
 * 获取指定分类的所有错误
 * @param {string} category 错误分类
 * @returns {Array} 错误信息数组
 */
export function getErrorsByCategory (category) {
  return Object.values(ErrorCodes).filter(error => error.category === category)
}

/**
 * 获取指定严重级别的所有错误
 * @param {string} severity 严重级别
 * @returns {Array} 错误信息数组
 */
export function getErrorsBySeverity (severity) {
  return Object.values(ErrorCodes).filter(error => error.severity === severity)
}
