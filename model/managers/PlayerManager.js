
import { RoleFactory } from '../roles/RoleFactory.js'
import { GameError } from '../core/GameError.js'
import { DEATH_REASONS } from '../core/Constants.js'

/**
 * 玩家管理器 - 负责管理游戏中的玩家生命周期
 * 分离自Game类的玩家管理职责
 */
export class PlayerManager {
  constructor (game) {
    this.game = game
    this.players = new Map()
    this.roles = new Map()
    this.playerNumberMap = new Map()

    // 缓存系统
    this._cacheSystem = {
      alivePlayers: {
        cache: null, // 基本存活玩家缓存
        campExclusions: {}, // 按阵营排除的缓存
        roleTypes: {}, // 按角色类型的缓存
        lastInvalidation: Date.now() // 上次缓存失效时间
      }
    }
  }

  /**
   * 添加玩家到游戏
   * @param {Player} player 玩家对象
   * @returns {boolean} 是否成功添加
   */
  addPlayer (player) {
    if (this.players.has(player.id)) {
      return false // Player already in game
    }
    this.players.set(player.id, player)
    this._invalidateCache()
    return true
  }

  /**
   * 检查玩家是否在游戏中
   * @param {string} playerId 玩家ID
   * @returns {boolean} 是否存在
   */
  hasPlayer (playerId) {
    return this.players.has(playerId)
  }

  /**
   * 获取玩家对象
   * @param {string} playerId 玩家ID
   * @returns {Player|null} 玩家对象
   */
  getPlayer (playerId) {
    return this.players.get(playerId) || null
  }

  /**
   * 获取所有玩家
   * @returns {Map} 玩家Map
   */
  getAllPlayers () {
    return this.players
  }

  /**
   * 获取玩家数量
   * @returns {number} 玩家数量
   */
  getPlayerCount () {
    return this.players.size
  }

  /**
   * 初始化玩家角色
   * @param {Array} roleConfig 角色配置数组
   * @throws {GameError} 当通信对象不可用或角色创建失败时抛出错误
   */
  async initializePlayerRoles (roleConfig) {
    const players = Array.from(this.players.values())
    const shuffledRoles = this.shuffle([...roleConfig])

    // 预先验证通信对象
    if (!this.game.e) {
      throw new GameError(
        '通信对象不可用，无法初始化玩家角色',
        'COMMUNICATION_OBJECT_MISSING',
        { playerCount: players.length, roleConfig }
      )
    }

    for (let i = 0; i < players.length; i++) {
      const playerInfo = players[i]
      const roleName = shuffledRoles[i]
      const gameNumber = i + 1 // 分配游戏内编号，从1开始

      // 更新玩家实例
      playerInfo.role = roleName
      playerInfo.gameNumber = gameNumber

      // 建立编号映射
      this.playerNumberMap.set(gameNumber, playerInfo)

      // 验证通信对象有效性
      if (!this.game.e) {
        throw new GameError(
          '通信对象不可用，无法创建角色实例',
          'COMMUNICATION_OBJECT_MISSING',
          { playerId: playerInfo.id, roleName }
        )
      }

      // 创建角色实例
      try {
        const role = RoleFactory.createRole(roleName, this.game, playerInfo, this.game.e)
        this.roles.set(playerInfo.id, role)
      } catch (error) {
        throw new GameError(
          `创建角色实例失败: ${error.message}`,
          'ROLE_CREATION_FAILED',
          { playerId: playerInfo.id, roleName, originalError: error.message }
        )
      }

      // 通知角色分配
      this.game.emit('roleNotify', {
        playerId: playerInfo.id,
        message: `你的游戏编号是：${gameNumber}号，角色是：${playerInfo.role}`
      })
    }

    // 初始化玩家后清空缓存
    this._invalidateCache()
  }

  /**
   * 获取存活玩家列表
   * @param {Object} options 选项
   * @returns {Array} 存活玩家数组
   */
  getAlivePlayers (options = {}) {
    const { excludeCamp = null, roleType = null, showRole = false, showStatus = false } = options

    // 构建缓存键
    const cacheKey = `${excludeCamp || 'none'}_${roleType || 'none'}_${showRole}_${showStatus}`

    // 检查缓存 - 对于基础查询，使用主缓存
    if (cacheKey === 'none_none_false_false' && this._cacheSystem.alivePlayers.cache) {
      return this._cacheSystem.alivePlayers.cache
    }

    // 检查特定缓存
    if (this._cacheSystem.alivePlayers.campExclusions[cacheKey]) {
      return this._cacheSystem.alivePlayers.campExclusions[cacheKey]
    }

    let alivePlayers = Array.from(this.players.values()).filter(player => player.isAlive)

    // 按阵营过滤
    if (excludeCamp) {
      alivePlayers = alivePlayers.filter(player => {
        const role = this.roles.get(player.id)
        return role && role.getCamp() !== excludeCamp
      })
    }

    // 按角色类型过滤
    if (roleType) {
      alivePlayers = alivePlayers.filter(player => {
        const role = this.roles.get(player.id)
        return role && role.constructor.name === roleType
      })
    }

    // 缓存结果
    if (cacheKey === 'none_none_false_false') {
      // 基础查询使用主缓存
      this._cacheSystem.alivePlayers.cache = alivePlayers
    } else {
      // 特定查询使用特定缓存
      this._cacheSystem.alivePlayers.campExclusions[cacheKey] = alivePlayers
    }

    return alivePlayers
  }

  /**
   * 根据游戏编号获取玩家
   * @param {number} gameNumber 游戏编号
   * @returns {Player|null} 玩家对象
   */
  getPlayerByNumber (gameNumber) {
    return this.playerNumberMap.get(gameNumber) || null
  }

  /**
   * 获取玩家角色
   * @param {string} playerId 玩家ID
   * @returns {Role|null} 角色对象
   */
  getPlayerRole (playerId) {
    return this.roles.get(playerId) || null
  }

  /**
   * 处理玩家死亡
   * @param {Player} player 玩家对象
   * @param {string} reason 死亡原因
   * @returns {boolean} 是否成功处理
   */
  async handlePlayerDeath (player, reason) {
    if (!player || !player.isAlive) return false

    try {
      // 1. 设置玩家死亡状态
      player.isAlive = false
      player.deathReason = reason

      // 2. 验证死亡原因
      if (!Object.values(DEATH_REASONS).includes(reason)) {
        console.warn(`[PlayerManager] 未知的死亡原因: ${reason}`)
      }

      // 玩家状态改变，清空缓存
      this._invalidateCache()

      // 通知玩家死亡
      this.game.emit('playerDeath', {
        player,
        reason
      })

      return true
    } catch (err) {
      console.error('[PlayerManager] 处理玩家死亡时出错:', err)
      this.game.emit('error', new GameError(
        '处理玩家死亡时出错',
        'PLAYER_DEATH_ERROR',
        { playerId: player.id, reason, error: err }
      ))
      return false
    }
  }

  /**
   * 清理玩家数据
   */
  cleanup () {
    console.log('[PlayerManager] 开始清理玩家数据')

    // 清理角色静态数据
    this.cleanupRoleStaticData()

    // 清理玩家数据
    this.players.clear()
    this.roles.clear()
    this.playerNumberMap.clear()

    // 清理缓存
    this._invalidateCache()

    console.log('[PlayerManager] 玩家数据清理完成')
  }

  /**
   * 清理角色静态数据
   * @private
   */
  cleanupRoleStaticData () {
    try {
      // 动态导入并清理WolfRole静态数据
      import('../roles/WolfRole.js').then(({ WolfRole }) => {
        if (WolfRole && typeof WolfRole.cleanup === 'function') {
          WolfRole.cleanup()
        }
      }).catch(error => {
        console.debug('[PlayerManager] 清理WolfRole静态数据时出错:', error.message)
      })
    } catch (error) {
      console.warn('[PlayerManager] 清理角色静态数据时出错:', error)
    }
  }

  /**
   * 使缓存失效
   * @private
   */
  _invalidateCache () {
    this._cacheSystem.alivePlayers.cache = null
    this._cacheSystem.alivePlayers.campExclusions = {}
    this._cacheSystem.alivePlayers.roleTypes = {}
    this._cacheSystem.alivePlayers.lastInvalidation = Date.now()
  }

  /**
   * 工具方法：打乱数组
   * @private
   * @param {Array} array 要打乱的数组
   * @returns {Array} 打乱后的数组
   */
  shuffle (array) {
    const arr = [...array]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
}

// {{END MODIFICATIONS}}
