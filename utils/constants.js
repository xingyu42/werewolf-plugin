/**
 * @file constants.js
 * @description 工具层常量定义，插件路径配置
 * @module utils/constants
 *
 * @input path
 * @output _path, PLUGIN_NAME, PLUGIN_PATH
 * @pos 工具层 - 基础常量
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

