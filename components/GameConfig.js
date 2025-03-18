import YAML from "yaml"
import chokidar from "chokidar"
import fs from "node:fs"
import _ from "lodash"
import cfg from "../../../lib/config/config.js"
import YamlReader from "./YamlReader.js"

const Path = process.cwd()
const Plugin_Name = "werewolf-plugin"
const Plugin_Path = `${Path}/plugins/${Plugin_Name}`
const Log_Prefix = "[狼人杀插件]"

class GameConfig {
  constructor() {
    this.config = {}

    /** 监听文件 */
    this.watcher = { config: {}, defSet: {} }

    this.initCfg()
  }

  /** 初始化配置 */
  initCfg() {
    let path = `${Plugin_Path}/config/config/`
    let pathDef = `${Plugin_Path}/config/default_config/`

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
      const files = fs.readdirSync(pathDef).filter(file => file.endsWith(".yaml"))
      for (let file of files) {
        if (!fs.existsSync(`${path}${file}`)) {
          fs.copyFileSync(`${pathDef}${file}`, `${path}${file}`)
        } else {
          this.other.autoMergeCfg && this.mergeCfg(`${path}${file}`, `${pathDef}${file}`, file)
        }
        this.watch(`${path}${file}`, file.replace(".yaml", ""), "config")
      }
    }
  }

  async mergeCfg(cfgPath, defPath, name) {
    // 默认文件未变化不合并
    let defData = fs.readFileSync(defPath, "utf8")
    let redisData = await redis.get(`werewolf:mergeCfg:${name}`)
    if (defData == redisData) return
    redis.set(`werewolf:mergeCfg:${name}`, defData)

    const userDoc = YAML.parseDocument(fs.readFileSync(cfgPath, "utf8"))
    const defDoc = YAML.parseDocument(defData)
    let isUpdate = false
    const merge = (user, def) => {
      const existingKeys = new Map()
      for (const item of user) {
        existingKeys.set(item.key.value, item.value)
      }
      for (const item of def) {
        if (item?.key?.commentBefore?.includes?.("noMerge")) continue
        if (!existingKeys.has(item.key.value)) {
          logger.info(`${Log_Prefix}[合并配置][${name}][${item.key.value}]`)
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
    isUpdate && fs.writeFileSync(cfgPath, yaml, "utf8")
  }

  /** 主人QQ */
  get masterQQ() {
    return cfg.masterQQ
  }

  get master() {
    return cfg.master
  }

  /** 获取其他设置 */
  get other() {
    return this.getDefOrConfig("other")
  }

  /** 获取游戏基础设置 */
  get game() {
    return this.getDefOrConfig("game")
  }

  /** 获取角色设置 */
  get roles() {
    return this.getDefOrConfig("roles")
  }

  /** 获取游戏模式设置 */
  get modes() {
    return this.getDefOrConfig("modes")
  }

  /**
   * 默认配置和用户配置
   * @param {string} name 配置名称
   */
  getDefOrConfig(name) {
    let def = this.getdefSet(name)
    let config = this.getConfig(name)
    function customizer(objValue, srcValue) {
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
  getdefSet(name) {
    return this.getYaml("default_config", name)
  }

  /**
   * 用户配置
   * @param {string} name 配置名称
   */
  getConfig(name) {
    return this.getYaml("config", name)
  }

  /**
   * 获取配置yaml
   * @param {string} type 默认配置-defSet，用户配置-config
   * @param {string} name 名称
   */
  getYaml(type, name) {
    let file = `${Plugin_Path}/config/${type}/${name}.yaml`
    let key = `${type}.${name}`

    if (this.config[key]) return this.config[key]

    if (!fs.existsSync(file)) {
      return {}
    }

    try {
      this.config[key] = YAML.parse(
        fs.readFileSync(file, "utf8")
      )

      this.watch(file, name, type)

      return this.config[key]
    } catch (e) {
      logger.error(`${Log_Prefix}[读取配置文件失败][${type}][${name}]：${e}`)
      return {}
    }
  }

  /**
   * 监听配置文件
   * @param {string} file 文件路径
   * @param {string} name 配置名称
   * @param {string} type 配置类型
   */
  watch(file, name, type = "default_config") {
    let key = `${type}.${name}`

    if (this.watcher[key]) return

    // eslint-disable-next-line import/no-named-as-default-member
    const watcher = chokidar.watch(file)
    watcher.on("change", path => {
      delete this.config[key]
      if (typeof Bot == "undefined") return
      logger.mark(`${Log_Prefix}[修改配置文件][${type}][${name}]`)
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
  modify(name, key, value, type = "config", bot = false, comment = null) {
    let path = `${bot ? Path : Plugin_Path}/config/${type}/${name}.yaml`

    // 确保目录存在
    const dir = path.substring(0, path.lastIndexOf('/'))
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // 确保文件存在
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, "", "utf8")
    }

    new YamlReader(path).set(key, value, comment)
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
  deleteKey(name, key, type = "config", bot = false) {
    let path = `${bot ? Path : Plugin_Path}/config/${type}/${name}.yaml`
    if (!fs.existsSync(path)) return false

    new YamlReader(path).deleteKey(key)
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
  modifyArr(name, key, value, category = "add", type = "config", bot = false) {
    let path = `${bot ? Path : Plugin_Path}/config/${type}/${name}.yaml`

    // 确保目录存在
    const dir = path.substring(0, path.lastIndexOf('/'))
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // 确保文件存在
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, "", "utf8")
    }

    let yaml = new YamlReader(path)
    if (category == "add") {
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

}

export default new GameConfig()
