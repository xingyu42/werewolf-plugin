/**
 * @file index.js
 * @description 插件主入口，动态加载 apps/ 目录下的所有应用模块
 * @module werewolf-plugin
 *
 * @input fs (node:fs), RoleFactory (./models/roles/RoleFactory.js), oicq (动态)
 * @output apps - 已加载的应用模块集合
 * @pos 入口层 - 插件启动入口，负责模块加载和初始化
 *
 * @dependencies
 * - node:fs - 文件系统操作
 * - ./models/roles/RoleFactory.js - 角色工厂（预加载）
 * - oicq - 消息段处理（动态导入）
 * - ./apps/*.js - 应用模块（动态加载）
 */
import fs from 'node:fs'
import { RoleFactory } from './models/roles/RoleFactory.js'

if (!global.segment) {
  global.segment = (await import('oicq')).segment
}

// 预加载角色模块，提高性能
logger.info(logger.blue('- 预加载狼人杀角色模块 -'))
await RoleFactory.preloadRoleModules()

const files = fs.readdirSync('./plugins/werewolf-plugin/apps').filter(file => file.endsWith('.js'))

let ret = []
let failedModules = []
let criticalModules = ['GameStart', 'GameAction', 'GameRoles'] // 关键模块列表

files.forEach((file) => {
  ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret)

let apps = {}
for (let i in files) {
  // 添加边界检查
  if (i >= files.length || i >= ret.length) {
    logger.error(`数组索引越界：i=${i}, files.length=${files.length}, ret.length=${ret.length}`)
    continue
  }

  let name = files[i].replace('.js', '')

  if (ret[i].status != 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`)
    logger.error(ret[i].reason)
    failedModules.push(name)

    // 检查是否为关键模块
    if (criticalModules.includes(name)) {
      logger.error(`关键模块 ${name} 加载失败，插件无法正常运行`)
      throw new Error(`Critical module ${name} failed to load: ${ret[i].reason}`)
    }
    continue
  }

  // 验证模块导出
  if (!ret[i].value || typeof ret[i].value !== 'object') {
    logger.error(`模块 ${name} 导出无效`)
    failedModules.push(name)
    continue
  }

  const exportKeys = Object.keys(ret[i].value)
  if (exportKeys.length === 0) {
    logger.error(`模块 ${name} 没有导出任何内容`)
    failedModules.push(name)
    continue
  }

  apps[name] = ret[i].value[exportKeys[0]]
}

// 报告加载结果
if (failedModules.length > 0) {
  logger.warn(`以下模块加载失败：${failedModules.join(', ')}`)
}
logger.info(logger.green('- 狼人杀插件载入成功 -'))

export { apps }
