#!/usr/bin/env node
/**
 * @file cli.js
 * @description Agent 专用 CLI 客户端 — 零依赖，纯 JSON 输出
 *
 * Usage:
 *   node plugins/werewolf-plugin/tools/cli.js send "#帮助" --group 123456
 *   node plugins/werewolf-plugin/tools/cli.js send "#创建狼人杀" --user 10001 --group 123
 *   node plugins/werewolf-plugin/tools/cli.js send "#结束狼人杀" --master --group 123
 *   node plugins/werewolf-plugin/tools/cli.js logs --lines 50
 *   node plugins/werewolf-plugin/tools/cli.js logs --type error
 *   node plugins/werewolf-plugin/tools/cli.js status
 */

import http from 'node:http'

const PORT = Number(process.env.MIAO_CLI_PORT) || 27880
const HOST = '127.0.0.1'
const BASE = `http://${HOST}:${PORT}`

// ==================== Argument Parsing ====================

function parseArgs () {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    return { command: 'help' }
  }

  const command = args[0]
  const flags = {}
  let positional = null

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      // Boolean flags
      if (key === 'master') {
        flags.master = true
        continue
      }
      // Value flags
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        flags[key] = args[i + 1]
        i++
      } else {
        flags[key] = true
      }
    } else if (!positional) {
      positional = arg
    }
  }

  return { command, positional, flags }
}

// ==================== HTTP Helpers ====================

function httpGet (urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${urlPath}`, { timeout: 10000 }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          resolve({ success: false, error: 'INVALID_JSON_RESPONSE', raw: data.slice(0, 500) })
        }
      })
    })
    req.on('error', (err) => reject(err))
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')) })
  })
}

function httpPost (urlPath, body) {
  const payload = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}${urlPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: (body.timeout_ms || 5000) + 5000
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          resolve({ success: false, error: 'INVALID_JSON_RESPONSE', raw: data.slice(0, 500) })
        }
      })
    })
    req.on('error', (err) => reject(err))
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')) })
    req.write(payload)
    req.end()
  })
}

// ==================== Commands ====================

async function cmdSend (text, flags) {
  if (!text) {
    return output({ success: false, error: 'INVALID_ARGS', message: '缺少消息文本', usage: 'cli.js send <text> [--group G] [--user U] [--master]' }, 1)
  }

  const body = {
    text,
    user_id: flags.user || '10001',
    is_master: !!flags.master
  }
  if (flags.group) body.group_id = flags.group
  if (flags.timeout) body.timeout_ms = Number(flags.timeout)

  try {
    const result = await httpPost('/api/message', body)
    output(result, result.success ? 0 : 1)
  } catch (err) {
    handleConnectionError(err)
  }
}

async function cmdLogs (flags) {
  const lines = flags.lines || '50'
  const type = flags.type || 'command'

  try {
    const result = await httpGet(`/api/logs?lines=${lines}&type=${type}`)
    output(result, result.success ? 0 : 1)
  } catch (err) {
    handleConnectionError(err)
  }
}

async function cmdStatus () {
  try {
    const result = await httpGet('/api/status')
    output(result, result.success ? 0 : 1)
  } catch (err) {
    handleConnectionError(err)
  }
}

async function cmdRestart () {
  try {
    const result = await httpPostSimple('/api/restart')
    output(result, 0)
  } catch (err) { handleConnectionError(err) }
}

async function cmdShutdown () {
  try {
    const result = await httpPostSimple('/api/shutdown')
    output(result, 0)
  } catch (err) { handleConnectionError(err) }
}

// ==================== Output ====================

function httpPostSimple (urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}${urlPath}`, {
      method: 'POST',
      timeout: 5000
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve({ success: false, raw: data.slice(0, 500) }) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')) })
    req.end()
  })
}

async function cmdPause (flags) {
  const group = flags.group
  if (!group) return output({ success: false, error: 'INVALID_ARGS', message: '缺少 --group 参数' }, 1)
  try {
    const result = await httpPostSimple(`/api/pause?group=${group}`)
    output(result, result.success ? 0 : 1)
  } catch (err) { handleConnectionError(err) }
}

async function cmdResume (flags) {
  const group = flags.group
  if (!group) return output({ success: false, error: 'INVALID_ARGS', message: '缺少 --group 参数' }, 1)
  try {
    const result = await httpPostSimple(`/api/resume?group=${group}`)
    output(result, result.success ? 0 : 1)
  } catch (err) { handleConnectionError(err) }
}

async function cmdMessages (flags) {
  const clear = flags.clear ? 'true' : 'false'
  try {
    const result = await httpGet(`/api/messages?clear=${clear}`)
    output(result, result.success ? 0 : 1)
  } catch (err) { handleConnectionError(err) }
}

// ==================== Output (original) ====================

function output (data, exitCode = 0) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n')
  process.exit(exitCode)
}

function handleConnectionError (err) {
  if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
    output({
      success: false,
      error: 'ECONNREFUSED',
      message: `Bot 未运行或 CliServer 未加载 (${HOST}:${PORT})`,
      hint: '请先启动 Bot: pnpm start'
    }, 1)
  } else if (err.message === 'TIMEOUT') {
    output({
      success: false,
      error: 'TIMEOUT',
      message: '请求超时'
    }, 1)
  } else {
    output({
      success: false,
      error: 'CONNECTION_ERROR',
      message: err.message || String(err)
    }, 1)
  }
}

// ==================== Main ====================

const { command, positional, flags } = parseArgs()

switch (command) {
  case 'send':
    await cmdSend(positional, flags)
    break
  case 'logs':
    await cmdLogs(flags)
    break
  case 'status':
    await cmdStatus()
    break
  case 'restart':
    await cmdRestart()
    break
  case 'shutdown':
  case 'kill':
  case 'stop':
    await cmdShutdown()
    break
  case 'pause':
    await cmdPause(flags)
    break
  case 'resume':
    await cmdResume(flags)
    break
  case 'messages':
    await cmdMessages(flags)
    break
  case 'help':
  default:
    output({
      success: true,
      commands: {
        'send <text>': 'Send message. Flags: --group G, --user U, --master, --timeout ms',
        'messages': 'Get async game messages. Flags: --clear',
        'pause': 'Pause game timers. Flags: --group G',
        'resume': 'Resume game. Flags: --group G',
        'logs': 'Get recent logs. Flags: --lines N, --type command|error',
        'status': 'Check Bot status',
        'restart': 'Restart Bot (exit process, use with auto-restart wrapper)',
        'shutdown': 'Gracefully shut down Bot process (alias: kill, stop)'
      },
      examples: [
        'cli.js send "#创建狼人杀" --user 10001 --group 123',
        'cli.js pause --group 123',
        'cli.js messages --clear',
        'cli.js send "#查验2号" --user 10004',
        'cli.js resume --group 123'
      ]
    }, 0)
}
