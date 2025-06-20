/**
 * 游戏注册表 - 管理游戏实例的生命周期
 * 增强版本，包含内存泄漏防护和资源清理机制
 */
export class GameRegistry {
  // 静态游戏实例存储
  static games = new Map()

  // 游戏创建时间记录，用于自动清理
  static gameTimestamps = new Map()

  // 配置选项
  static config = {
    maxGameAge: 24 * 60 * 60 * 1000, // 24小时后自动清理
    maxGames: 100, // 最大游戏数量
    cleanupInterval: 60 * 60 * 1000, // 1小时清理一次
    enableAutoCleanup: true
  }

  // 清理定时器
  static cleanupTimer = null

  /**
     * 初始化注册表，启动自动清理机制
     */
  static initialize () {
    if (this.config.enableAutoCleanup && !this.cleanupTimer) {
      this.cleanupTimer = setInterval(async () => {
        await this.performAutoCleanup()
      }, this.config.cleanupInterval)

      console.log('[GameRegistry] 自动清理机制已启动')
    }
  }

  /**
     * 获取游戏实例
     */
  static getGame (groupId) {
    const game = this.games.get(groupId)

    // 更新访问时间
    if (game) {
      this.gameTimestamps.set(groupId, Date.now())
    }

    return game
  }

  /**
     * 添加游戏实例
     */
  static async addGame (groupId, gameInstance) {
    // 检查是否超过最大游戏数量
    if (this.games.size >= this.config.maxGames) {
      console.warn(`[GameRegistry] 达到最大游戏数量限制 (${this.config.maxGames})，执行清理`)
      await this.performAutoCleanup()

      // 如果清理后仍然超限，拒绝添加
      if (this.games.size >= this.config.maxGames) {
        throw new Error('游戏数量已达上限，请稍后再试')
      }
    }

    this.games.set(groupId, gameInstance)
    this.gameTimestamps.set(groupId, Date.now())

    // 确保自动清理机制已启动
    this.initialize()

    console.log(`[GameRegistry] 游戏已添加: ${groupId}, 当前游戏数: ${this.games.size}`)
  }

  /**
     * 移除游戏实例并清理相关资源
     */
  static removeGame (groupId) {
    const game = this.games.get(groupId)

    if (game) {
      // 清理游戏资源
      this.cleanupGameResources(game)

      // 从注册表中移除
      this.games.delete(groupId)
      this.gameTimestamps.delete(groupId)

      console.log(`[GameRegistry] 游戏已移除: ${groupId}, 当前游戏数: ${this.games.size}`)
    }
  }

  /**
     * 检查游戏是否存在（增强版，支持持久化状态检查）
     */
  static async hasGame (groupId) {
    // 检查内存中的游戏实例
    if (this.games.has(groupId)) {
      const game = this.games.get(groupId)

      // 验证游戏实例是否仍然有效
      try {
        // 检查游戏是否有基本的管理器和玩家
        const isValid = game &&
                       game.playerManager &&
                       typeof game.playerManager.getPlayerCount === 'function' &&
                       game.playerManager.getPlayerCount() > 0

        if (isValid) {
          // 更新访问时间
          this.gameTimestamps.set(groupId, Date.now())
          return true
        } else {
          // 游戏实例无效，清理它
          console.warn(`[GameRegistry] 发现无效游戏实例: ${groupId}，正在清理`)
          this.removeGame(groupId)
        }
      } catch (error) {
        console.error(`[GameRegistry] 验证游戏实例时出错: ${groupId}`, error)
        this.removeGame(groupId)
      }
    }

    // 检查持久化状态
    if (global.redis) {
      try {
        const stateKey = `werewolf:gamestate:${groupId}`
        const stateDataStr = await global.redis.get(stateKey)

        if (stateDataStr) {
          const stateData = JSON.parse(stateDataStr)

          // 检查状态是否过期（24小时）
          const now = Date.now()
          const age = now - stateData.timestamp

          if (age < 86400000) { // 24小时内
            console.log(`[GameRegistry] 发现有效的持久化游戏状态: ${groupId}`)
            return true
          } else {
            // 清理过期状态
            console.log(`[GameRegistry] 清理过期的游戏状态: ${groupId}`)
            await global.redis.del(stateKey)
          }
        }
      } catch (error) {
        console.error(`[GameRegistry] 检查持久化状态时出错: ${groupId}`, error)
      }
    }

    return false
  }

  /**
   * 同步检查游戏是否存在（仅检查内存中的实例）
   * @param {string} groupId 群组ID
   * @returns {boolean} 是否存在游戏
   */
  static hasGameSync (groupId) {
    if (this.games.has(groupId)) {
      const game = this.games.get(groupId)

      try {
        // 验证游戏实例是否仍然有效
        const isValid = game &&
                       game.playerManager &&
                       typeof game.playerManager.getPlayerCount === 'function' &&
                       game.playerManager.getPlayerCount() > 0

        if (isValid) {
          this.gameTimestamps.set(groupId, Date.now())
          return true
        } else {
          this.removeGame(groupId)
        }
      } catch (error) {
        console.error(`[GameRegistry] 验证游戏实例时出错: ${groupId}`, error)
        this.removeGame(groupId)
      }
    }

    return false
  }

  /**
   * 检查并清理持久化状态中的过期游戏
   * @returns {Promise<number>} 清理的游戏数量
   */
  static async cleanupExpiredPersistedStates () {
    if (!global.redis) {
      return 0
    }

    try {
      const pattern = 'werewolf:gamestate:*'
      const keys = await global.redis.keys(pattern)
      let cleanedCount = 0
      const now = Date.now()

      for (const key of keys) {
        try {
          const stateDataStr = await global.redis.get(key)
          if (!stateDataStr) continue

          const stateData = JSON.parse(stateDataStr)
          const age = now - stateData.timestamp

          // 清理超过24小时的状态
          if (age > 86400000) {
            await global.redis.del(key)
            cleanedCount++
            console.log(`[GameRegistry] 清理过期持久化状态: ${key}`)
          }
        } catch (error) {
          // 如果解析失败，直接删除
          await global.redis.del(key)
          cleanedCount++
          console.log(`[GameRegistry] 清理无效持久化状态: ${key}`)
        }
      }

      if (cleanedCount > 0) {
        console.log(`[GameRegistry] 持久化状态清理完成，共清理 ${cleanedCount} 个过期状态`)
      }

      return cleanedCount
    } catch (error) {
      console.error('[GameRegistry] 清理持久化状态时出错:', error)
      return 0
    }
  }

  /**
     * 清理游戏相关资源
     * @private
     */
  static cleanupGameResources (game) {
    try {
      // 清理事件监听器
      if (game && typeof game.removeAllListeners === 'function') {
        game.removeAllListeners()
      }

      // 清理游戏内部资源
      if (game && typeof game.cleanup === 'function') {
        game.cleanup()
      }

      // 清理角色静态数据
      this.cleanupRoleStaticData()
    } catch (error) {
      console.error('[GameRegistry] 清理游戏资源时发生错误:', error)
    }
  }

  /**
     * 清理角色静态数据
     * @private
     */
  static cleanupRoleStaticData () {
    try {
      // 动态导入并清理 WolfRole 静态数据
      import('../roles/WolfRole.js').then(({ WolfRole }) => {
        if (WolfRole && typeof WolfRole.cleanup === 'function') {
          WolfRole.cleanup()
        }
      }).catch(error => {
        console.debug('[GameRegistry] 清理WolfRole静态数据时出错:', error.message)
      })
    } catch (error) {
      // 模块可能未加载，忽略错误
      console.debug('[GameRegistry] 清理角色静态数据时出现错误:', error.message)
    }
  }

  /**
     * 执行自动清理（增强版，包含持久化状态清理）
     * @private
     */
  static async performAutoCleanup () {
    const now = Date.now()
    const expiredGames = []

    // 查找过期游戏
    for (const [groupId, timestamp] of this.gameTimestamps.entries()) {
      if (now - timestamp > this.config.maxGameAge) {
        expiredGames.push(groupId)
      }
    }

    // 清理过期游戏
    if (expiredGames.length > 0) {
      console.log(`[GameRegistry] 清理 ${expiredGames.length} 个过期游戏:`, expiredGames)

      for (const groupId of expiredGames) {
        this.removeGame(groupId)
      }
    }

    // 清理持久化状态中的过期游戏
    try {
      const cleanedPersistedCount = await this.cleanupExpiredPersistedStates()
      if (cleanedPersistedCount > 0) {
        console.log(`[GameRegistry] 额外清理了 ${cleanedPersistedCount} 个过期的持久化状态`)
      }
    } catch (error) {
      console.error('[GameRegistry] 清理持久化状态时出错:', error)
    }

    console.log(`[GameRegistry] 自动清理完成，当前游戏数: ${this.games.size}`)
  }

  /**
     * 获取注册表统计信息
     */
  static getStats () {
    return {
      totalGames: this.games.size,
      maxGames: this.config.maxGames,
      oldestGameAge: this.getOldestGameAge(),
      autoCleanupEnabled: this.config.enableAutoCleanup
    }
  }

  /**
     * 获取最老游戏的年龄
     * @private
     */
  static getOldestGameAge () {
    if (this.gameTimestamps.size === 0) return 0

    const now = Date.now()
    let oldestAge = 0

    for (const timestamp of this.gameTimestamps.values()) {
      const age = now - timestamp
      if (age > oldestAge) {
        oldestAge = age
      }
    }

    return oldestAge
  }

  /**
     * 手动清理所有游戏（用于测试或紧急情况）
     */
  static clearAll () {
    console.log(`[GameRegistry] 手动清理所有游戏，共 ${this.games.size} 个`)

    for (const [groupId] of this.games.entries()) {
      this.removeGame(groupId)
    }
  }

  /**
     * 关闭注册表，清理所有资源
     */
  static shutdown () {
    // 停止自动清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // 清理所有游戏
    this.clearAll()

    console.log('[GameRegistry] 注册表已关闭')
  }
}
