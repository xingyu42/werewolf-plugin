import fs from 'node:fs'
import { RoleFactory } from './model/roles/RoleFactory.js'

if (!global.segment) {
  global.segment = (await import("oicq")).segment
}

// 预加载角色模块，提高性能
logger.info(logger.blue(`- 预加载狼人杀角色模块 -`))
await RoleFactory.preloadRoleModules()

const files = fs.readdirSync('./plugins/werewolf-plugin/apps').filter(file => file.endsWith('.js'))

let ret = []

files.forEach((file) => {
  ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret)

let apps = {}
for (let i in files) {
  let name = files[i].replace('.js', '')

  if (ret[i].status != 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`)
    logger.error(ret[i].reason)
    continue
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}
logger.info(logger.green(`- 狼人杀插件载入成功 -`))


export { apps }