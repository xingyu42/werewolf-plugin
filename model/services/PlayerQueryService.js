/**
 * 玩家查询服务
 * 提供高效的玩家查询和缓存功能
 */

export class PlayerQueryService {
  constructor () {
    this.players = new Map()
    this.roles = new Map()
    this.playerNumberMap = new Map()
    this._cacheSystem = {
      alivePlayers: {
        cache: null,
        campExclusions: {},
        roleTypes: {},
        lastInvalidation: 0
      }
    }
  }

  setContext (players, roles, playerNumberMap, cacheSystem) {
    this.players = players
    this.roles = roles
    this.playerNumberMap = playerNumberMap
    this._cacheSystem = cacheSystem
  }

  getPlayerIdByNumber (gameNumber) {
    return this.playerNumberMap.get(gameNumber.toString())
  }

  getPlayerByNumber (gameNumber) {
    const playerId = this.getPlayerIdByNumber(gameNumber)
    if (!playerId) return null
    return this.players.get(playerId)
  }

  getAlivePlayers ({
    excludeIds = [],
    excludeCamp = null,
    roleType = null,
    includeRole = false,
    showRole = false,
    showStatus = false
  } = {}) {
    const cacheKey = this._getAlivePlayersCacheKey({ excludeIds, excludeCamp, roleType, includeRole })
    const alivePlayersCache = this._cacheSystem.alivePlayers

    if (alivePlayersCache.cache && alivePlayersCache.cache[cacheKey]) {
      return alivePlayersCache.cache[cacheKey]
    }

    let alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive)

    if (excludeIds.length > 0) {
      const excludeSet = new Set(excludeIds)
      alivePlayers = alivePlayers.filter(p => !excludeSet.has(p.id))
    }

    if (excludeCamp) {
      alivePlayers = alivePlayers.filter(p => p.role.camp !== excludeCamp)
    }

    if (roleType) {
      alivePlayers = alivePlayers.filter(p => p.role.constructor.name === roleType)
    }

    const result = includeRole
      ? alivePlayers.map(p => ({ player: p, role: this.roles.get(p.id) }))
      : alivePlayers

    if (!alivePlayersCache.cache) {
      alivePlayersCache.cache = {}
    }
    alivePlayersCache.cache[cacheKey] = result

    return result
  }

  _getAlivePlayersCacheKey (options) {
    const { excludeIds = [], excludeCamp = null, roleType = null, includeRole = false } = options
    return JSON.stringify({
      excludeIds: excludeIds.sort(),
      excludeCamp,
      roleType,
      includeRole
    })
  }
}
