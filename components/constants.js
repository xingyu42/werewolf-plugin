/**
 * @file constants.js
 * @description 组件级常量定义，插件路径配置
 * @module components/constants
 *
 * @input path
 * @output _path, PLUGIN_NAME, PLUGIN_PATH
 * @pos 组件层 - 基础常量
 *
 * @dependencies
 * - path - 路径处理
 */
import path from 'path'

const _path = process.cwd()
const PLUGIN_NAME = 'werewolf-plugin'
const PLUGIN_PATH = path.join(_path, 'plugins', PLUGIN_NAME)

export {
  _path,
  PLUGIN_NAME,
  PLUGIN_PATH
}
