import path from 'path'

const _path = process.cwd()
const PLUGIN_NAME = 'werewolf-plugin'
const PLUGIN_PATH = path.join(_path, 'plugins', PLUGIN_NAME)

export {
  _path,
  PLUGIN_NAME,
  PLUGIN_PATH
} 