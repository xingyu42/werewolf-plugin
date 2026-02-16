/**
 * @file GameConfig.js
 * @description 游戏配置管理器，支持热更新
 * @module components/GameConfig
 *
 * @input YAML, chokidar, fs, lodash, cfg, YamlReader, constants
 * @output GameConfig - 配置管理类
 * @pos 组件层 - 配置管理，支持热更新
 *
 * @dependencies
 * - yaml - YAML 解析
 * - chokidar - 文件监听
 * - node:fs - 文件系统
 * - lodash - 工具库
 * - ../../../lib/config/config.js - 框架配置
 * - ./YamlReader.js - YAML 读取
 * - ./constants.js - 组件常量
 */
import YAML from 'yaml'
import chokidar from 'chokidar'
import fs from 'node:fs'
import _ from 'lodash'
import cfg from '../../../lib/config/config.js'
import YamlReader from './YamlReader.js'
import { PLUGIN_NAME, PLUGIN_PATH } from './constants.js'

const logPrefix = `[${PLUGIN_NAME}插件]`

class GameConfig {
  constructor (redis, logger) {
    this.redis = redis
    this.logger = logger || console // 使用 console 作为默认 logger
    this.config = {}

    /** 监听文件 */
    this.watcher = { config: {}, defSet: {} }

    this.initCfg()
  }

  /** 初始化配置 */
  initCfg () {
    let path = `${PLUGIN_PATH}/config/config/`
    let pathDef = `${PLUGIN_PATH}/config/default_config/`

    // 确保配置目录存在
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, { recursive: true })
    }

    // 确保默认配置目录存在
    if (!fs.existsSync(pathDef)) {
      fs.mkdirSync(pathDef, { recursive: true })
    }

    // 读取默认配置目录下的所有yaml文件
    if (fs.existsSync(pathDef)) {
      const files = fs.readdirSync(pathDef).filter(file => file.endsWith('.yaml'))
      for (let file of files) {
        if (!fs.existsSync(`${path}${file}`)) {
          fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
        } else {
          // 安全地检查 autoMergeCfg 配置，避免在初始化时出现循环依赖
          try {
            const otherConfig = this.getYaml('config', 'other')
            const autoMergeCfg = otherConfig?.autoMergeCfg !== false // 默认为 true
            autoMergeCfg && this.mergeCfg(`${path}${file}`, `${pathDef}${file}`, file)
          } catch (e) {
            // 如果读取配置失败，默认进行合并
            this.mergeCfg(`${path}${file}`, `${pathDef}${file}`, file)
          }
        }
        this.watch(`${path}${file}`, file.replace('.yaml', ''), 'config')
      }
    }
  }

  async mergeCfg (cfgPath, defPath, name) {
    try {
      // 默认文件未变化不合并
      let defData = fs.readFileSync(defPath, 'utf8')

      // 安全地访问 redis，如果 redis 不可用则跳过缓存检查
      let redisData = null
      if (this.redis) {
        try {
          redisData = await this.redis.get(`werewolf:mergeCfg:${name}`)
        } catch (e) {
          this.logger.warn(`${logPrefix}[Redis访问失败][${name}]：${e}`)
        }
      }

      if (defData == redisData) return

      // 安全地设置 redis 缓存
      if (this.redis) {
        try {
          this.redis.set(`werewolf:mergeCfg:${name}`, defData)
        } catch (e) {
          this.logger.warn(`${logPrefix}[Redis设置失败][${name}]：${e}`)
        }
      }

      const userDoc = YAML.parseDocument(fs.readFileSync(cfgPath, 'utf8'))
      const defDoc = YAML.parseDocument(defData)
      let isUpdate = false
      const merge = (user, def) => {
        const existingKeys = new Map()
        for (const item of user) {
          existingKeys.set(item.key.value, item.value)
        }
        for (const item of def) {
          if (item?.key?.commentBefore?.includes?.('noMerge')) continue
          if (!existingKeys.has(item.key.value)) {
            this.logger.info(`${logPrefix}[合并配置][${name}][${item.key.value}]`)
            user.push(item)
            isUpdate = true
          } else if (YAML.isMap(item.value)) {
            const userV = existingKeys.get(item.key.value).items
            merge(userV, item.value.items)
          }
        }
      }
      merge(userDoc.contents.items, defDoc.contents.items)
      let yaml = userDoc.toString()
      isUpdate && fs.writeFileSync(cfgPath, yaml, 'utf8')
    } catch (e) {
      this.logger.error(`${logPrefix}[合并配置文件失败][${name}]：${e}`)
    }
  }

  /** 主人QQ */
  get masterQQ () {
    return cfg.masterQQ
  }

  get master () {
    return cfg.master
  }

  /** 获取其他设置 */
  get other () {
    return this.getDefOrConfig('other')
  }

  /** 获取游戏基础设置 */
  get game () {
    return this.getDefOrConfig('game')
  }

  /** 获取角色设置 */
  get roles () {
    return this.getDefOrConfig('roles')
  }

  /** 获取游戏模式设置 */
  get modes () {
    return this.getDefOrConfig('modes')
  }

  /**
   * 安全地获取配置值
   * @param {string} configName 配置文件名
   * @param {string} key 配置键名（使用CONFIG_KEYS常量）
   * @param {any} defaultValue 默认值
   * @returns {any} 配置值
   */
  getConfigValue (configName, key, defaultValue = null) {
    try {
      const config = this.getDefOrConfig(configName)
      const value = config[key]

      // 如果值不存在，返回默认值
      if (value === undefined || value === null) {
        return defaultValue
      }

      return value
    } catch (error) {
      this.logger.error(`${logPrefix}获取配置 ${configName}.${key} 失败：${error}`)
      return defaultValue
    }
  }

  /**
   * 获取游戏配置的便捷方法
   * @param {string} key 配置键名（使用CONFIG_KEYS常量）
   * @param {any} defaultValue 默认值
   * @returns {any} 配置值
   */
  getGameConfig (key, defaultValue = null) {
    return this.getConfigValue('game', key, defaultValue)
  }

  /**
   * 配置热重载机制
   * 当配置文件发生变化时，自动重新加载配置
   */
  enableHotReload () {
    // 重写原有的watch方法，添加热重载逻辑
    this.watch = (file, name, type = 'default_config') => {
      let key = `${type}.${name}`

      if (this.watcher[key]) return

      // eslint-disable-next-line import/no-named-as-default-member
      const watcher = chokidar.watch(file)
      watcher.on('change', path => {
        delete this.config[key]

        try {
          // 重新加载配置（不做校验）
          this.getYaml(type, name)
        } catch (error) {
          this.logger.error(`${logPrefix}[配置热重载失败][${type}][${name}]：${error}`)
        }

        if (typeof Bot == 'undefined') return
        this.logger.mark(`${logPrefix}[修改配置文件][${type}][${name}]`)
        if (this[`change_${name}`]) {
          this[`change_${name}`]()
        }
      })

      this.watcher[key] = watcher
    }
  }

  /**
   * 默认配置和用户配置
   * @param {string} name 配置名称
   */
  getDefOrConfig (name) {
    let def = this.getdefSet(name)
    let config = this.getConfig(name)
    function customizer (objValue, srcValue) {
      if (_.isArray(objValue)) {
        return srcValue
      }
    }
    return _.mergeWith({}, def, config, customizer)
  }

  /**
   * 默认配置
   * @param {string} name 配置名称
   */
  getdefSet (name) {
    return this.getYaml('default_config', name)
  }

  /**
   * 用户配置
   * @param {string} name 配置名称
   */
  getConfig (name) {
    return this.getYaml('config', name)
  }

  /**
   * 获取配置yaml
   * @param {string} type 默认配置-defSet，用户配置-config
   * @param {string} name 名称
   */
  getYaml (type, name) {
    let file = `${PLUGIN_PATH}/config/${type}/${name}.yaml`
    let key = `${type}.${name}`

    if (this.config[key]) return this.config[key]

    if (!fs.existsSync(file)) {
      return {}
    }

    try {
      this.config[key] = YAML.parse(
        fs.readFileSync(file, 'utf8')
      )

      this.watch(file, name, type)

      return this.config[key]
    } catch (e) {
      this.logger.error(`${logPrefix}[读取配置文件失败][${type}][${name}]：${e}`)
      return {}
    }
  }

  /**
   * 监听配置文件
   * @param {string} file 文件路径
   * @param {string} name 配置名称
   * @param {string} type 配置类型
   */
  watch (file, name, type = 'default_config') {
    let key = `${type}.${name}`

    if (this.watcher[key]) return

    // eslint-disable-next-line import/no-named-as-default-member
    const watcher = chokidar.watch(file)
    watcher.on('change', path => {
      delete this.config[key]
      if (typeof Bot == 'undefined') return
      this.logger.mark(`${logPrefix}[修改配置文件][${type}][${name}]`)
      if (this[`change_${name}`]) {
        this[`change_${name}`]()
      }
    })

    this.watcher[key] = watcher
  }

  /**
   * 修改设置
   * @param {string} name 文件名
   * @param {string} key 修改的key值
   * @param {string | number} value 修改的value值
   * @param {'config'|'default_config'} type 配置文件或默认
   * @param {boolean} bot 是否修改Bot的配置
   * @param {string} comment 注释
   */
  modify (name, key, value, type = 'config', bot = false, comment = null) {
    let path = `${bot ? process.cwd() : PLUGIN_PATH}/config/${type}/${name}.yaml`

    // 确保目录存在
    const dir = path.substring(0, path.lastIndexOf('/'))
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // 确保文件存在
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, '', 'utf8')
    }

    try {
      new YamlReader(path).set(key, value, comment)
    } catch (e) {
      this.logger.error(`${logPrefix}[修改配置文件失败][${name}]：${e}`)
      return false
    }

    delete this.config[`${type}.${name}`]
    return true
  }

  /**
   * 删除配置项
   * @param {string} name 文件名
   * @param {string} key 要删除的key
   * @param {'config'|'default_config'} type 配置文件或默认
   * @param {boolean} bot 是否修改Bot的配置
   */
  deleteKey (name, key, type = 'config', bot = false) {
    let path = `${bot ? process.cwd() : PLUGIN_PATH}/config/${type}/${name}.yaml`
    if (!fs.existsSync(path)) return false

    try {
      new YamlReader(path).deleteKey(key)
    } catch (e) {
      this.logger.error(`${logPrefix}[删除配置文件键失败][${name}]：${e}`)
      return false
    }

    delete this.config[`${type}.${name}`]
    return true
  }

  /**
   * 修改配置数组
   * @param {string} name 文件名
   * @param {string} key key值
   * @param {string | number} value value
   * @param {'add'|'del'} category 类别 add or del
   * @param {'config'|'default_config'} type 配置文件或默认
   * @param {boolean} bot 是否修改Bot的配置
   */
  modifyArr (name, key, value, category = 'add', type = 'config', bot = false) {
    let path = `${bot ? process.cwd() : PLUGIN_PATH}/config/${type}/${name}.yaml`

    // 确保目录存在
    const dir = path.substring(0, path.lastIndexOf('/'))
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // 确保文件存在
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, '', 'utf8')
    }

    let yaml = new YamlReader(path)
    if (category == 'add') {
      yaml.addIn(key, value)
    } else {
      let arr = yaml.get(key)
      if (Array.isArray(arr)) {
        let index = arr.indexOf(value)
        if (index !== -1) {
          yaml.delete(`${key}.${index}`)
        }
      }
    }
    delete this.config[`${type}.${name}`]
    return true
  }

  /**
   * 清理所有文件监听器
   * 在游戏结束或插件卸载时调用
   */
  cleanup () {
    for (const key in this.watcher) {
      const watcher = this.watcher[key]
      if (watcher && typeof watcher.close === 'function') {
        watcher.close()
      }
    }
    this.watcher = {}
    this.logger.mark(`${logPrefix}[配置监听器已清理]`)
  }
}

const globalKey = '__werewolf_plugin_gameConfig'
if (!global[globalKey]) {
  global[globalKey] = new GameConfig(global.redis, global.logger || console)
}

export { GameConfig }
export default global[globalKey]
