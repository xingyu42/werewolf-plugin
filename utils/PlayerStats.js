/**
 * @file PlayerStats.js
 * @description PlayerStats singleton instance (replacement for the removed service locator)
 * @module utils/PlayerStats
 */
import Data from './Data.js'
import PlayerStatsClass from '../models/PlayerStats.js'

const globalKey = '__werewolf_plugin_playerStats'

// Keep the previous services.js behavior (Data wrapper with redis-bound cache helpers).
const redisInstance = global.redis
const dataWithRedis = {
  ...Data,
  getCacheJSON: (key) => Data.getCacheJSON(redisInstance, key),
  setCacheJSON: (key, data, EX) => Data.setCacheJSON(redisInstance, key, data, EX)
}

if (!global[globalKey]) {
  global[globalKey] = new PlayerStatsClass(dataWithRedis, redisInstance)
}

export { PlayerStatsClass }
export default global[globalKey]
