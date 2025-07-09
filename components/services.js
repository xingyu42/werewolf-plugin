import Data from './Data.js'
import GameConfig from './GameConfig.js'
import YamlReader from './YamlReader.js'
import Puppeteer from './puppeteer.js'
import PlayerStats from '../model/cqrs/PlayerStats.js'

// Assume redis and logger are available globally in the execution environment.
// This is a common pattern in the Yunzai-Bot framework.
const redisInstance = global.redis
const loggerInstance = global.logger

// Create a new data object with redis-bound cache methods
const dataWithRedis = {
  ...Data,
  getCacheJSON: (key) => Data.getCacheJSON(redisInstance, key),
  setCacheJSON: (key, data, EX) => Data.setCacheJSON(redisInstance, key, data, EX)
}

const puppeteerInstance = new Puppeteer(loggerInstance)
const gameConfigInstance = new GameConfig(redisInstance, loggerInstance)
const playerStatsInstance = new PlayerStats(dataWithRedis, redisInstance)

export {
  dataWithRedis as Data,
  gameConfigInstance as GameConfig,
  YamlReader,
  puppeteerInstance as Puppeteer,
  playerStatsInstance as PlayerStats
}
