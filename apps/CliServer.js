/**
 * @file CliServer.js
 * @description Agent 专用 HTTP 调试桥：在 Bot 进程内启动 localhost HTTP 服务器，
 *              接收 CLI 请求，构造 fakeE，调用 PluginsLoader.deal(e)，捕获回复并返回 JSON。
 * @module apps/CliServer
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { GameController } from '../controllers/GameController.js'

const DEFAULT_PORT = 27880
const MAX_BODY = 1024 * 1024 // 1MB
const DEFAULT_TIMEOUT = 5000
const DEFAULT_GRACE = 150
const MAX_TIMEOUT = 30000
const MAX_MSG_BUFFER = 200

// Global message buffer — persists across requests, captures async game messages
globalThis.__miaoCliMessages = globalThis.__miaoCliMessages || []

// Known timer property names on game state objects
const TIMER_PROPS = [
  'timer', 'speakTimeout', '_hunterShootTimeout', 'discussionTimeout',
  'votingTimeout', 'subPhaseTimeout', 'speechTimeout', 'voteTimeout',
  '_registerTimer', '_voteTimer', '_retryTimer'
]

export class CliServer extends plugin {
  constructor () {
    super({
      name: 'miao-cli-server',
      dsc: 'Agent CLI debug bridge',
      event: 'message',
      priority: 999999,
      rule: []
    })
  }

  async init () {
    const port = Number(process.env.MIAO_CLI_PORT) || DEFAULT_PORT

    // Singleton: survive hot reloads
    if (globalThis.__miaoCliServer?.server?.listening) {
      return
    }

    try {
      const server = http.createServer((req, res) => this._route(req, res))

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          logger.warn(`[miao-cli] 端口 ${port} 已被占用，CliServer 未启动`)
        } else {
          logger.error(`[miao-cli] HTTP 服务器错误:`, err)
        }
      })

      await new Promise((resolve, reject) => {
        server.listen(port, '127.0.0.1', () => resolve())
        server.once('error', reject)
      })

      globalThis.__miaoCliServer = {
        server,
        port,
        startedAt: Date.now()
      }

      logger.info(`[miao-cli] HTTP 调试桥已启动 → http://127.0.0.1:${port}`)
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`[miao-cli] 端口 ${port} 已被占用，跳过启动`)
      } else {
        logger.error(`[miao-cli] 启动失败:`, err)
      }
    }
  }

  // ==================== HTTP Router ====================

  _route (req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`)

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')

    if (req.method === 'GET' && url.pathname === '/api/status') {
      return this._handleStatus(req, res)
    }

    if (req.method === 'GET' && url.pathname === '/api/logs') {
      return this._handleLogs(req, res, url.searchParams)
    }

    if (req.method === 'POST' && url.pathname === '/api/message') {
      return this._handleMessage(req, res)
    }

    if (req.method === 'POST' && url.pathname === '/api/pause') {
      return this._handlePause(req, res, url.searchParams)
    }

    if (req.method === 'POST' && url.pathname === '/api/resume') {
      return this._handleResume(req, res, url.searchParams)
    }

    if (req.method === 'GET' && url.pathname === '/api/messages') {
      return this._handleMessages(req, res, url.searchParams)
    }

    if (req.method === 'POST' && url.pathname === '/api/restart') {
      return this._handleRestart(req, res)
    }

    this._json(res, 404, { success: false, error: 'NOT_FOUND' })
  }

  // ==================== GET /api/status ====================

  _handleStatus (_req, res) {
    const botUin = global.Bot?.uin ?? null
    const pluginsLoaded = (await_loader())?.priority?.length ?? 0
    const info = globalThis.__miaoCliServer

    this._json(res, 200, {
      success: true,
      online: !!botUin,
      bot_uin: botUin,
      plugins_loaded: pluginsLoaded,
      miao_cli_port: info?.port ?? DEFAULT_PORT,
      ready: !!botUin,
      server_uptime_ms: info ? Date.now() - info.startedAt : 0
    })
  }

  // ==================== GET /api/logs ====================

  _handleLogs (_req, res, params) {
    const lines = Math.min(Math.max(Number(params.get('lines')) || 50, 1), 1000)
    const type = params.get('type') === 'error' ? 'error' : 'command'
    const date = params.get('date') || formatDate(new Date())

    let filePath
    if (type === 'error') {
      filePath = path.resolve(process.cwd(), 'logs', 'error.log')
    } else {
      filePath = path.resolve(process.cwd(), 'logs', `command.${date}.log`)
    }

    try {
      if (!fs.existsSync(filePath)) {
        return this._json(res, 200, {
          success: true,
          file: filePath,
          logs: [],
          count: 0,
          warning: 'LOG_FILE_NOT_FOUND'
        })
      }

      const content = fs.readFileSync(filePath, 'utf8')
      const allLines = content.split(/\r?\n/).filter(l => l.length > 0)
      const tail = allLines.slice(-lines)
      // Strip ANSI escape codes
      const cleaned = tail.map(l => l.replace(/\x1b\[[0-9;]*m/g, ''))

      this._json(res, 200, {
        success: true,
        file: filePath,
        logs: cleaned,
        count: cleaned.length
      })
    } catch (err) {
      this._json(res, 500, {
        success: false,
        error: `LOG_READ_ERROR: ${err.message}`
      })
    }
  }

  // ==================== POST /api/message ====================

  async _handleMessage (req, res) {
    // Read body
    let body
    try {
      body = await readBody(req, MAX_BODY)
    } catch (err) {
      return this._json(res, 400, { success: false, error: `BAD_REQUEST: ${err.message}` })
    }

    // Parse JSON
    let data
    try {
      data = JSON.parse(body)
    } catch {
      return this._json(res, 400, { success: false, error: 'BAD_JSON' })
    }

    // Validate
    if (!data.text || typeof data.text !== 'string') {
      return this._json(res, 400, { success: false, error: 'MISSING_TEXT' })
    }

    // Check bot ready
    const loader = await_loader()
    if (!loader || !global.Bot?.uin) {
      return this._json(res, 503, { success: false, error: 'BOT_NOT_READY' })
    }

    const requestId = crypto.randomBytes(4).toString('hex')
    const startedAt = Date.now()
    const timeoutMs = clamp(Number(data.timeout_ms) || DEFAULT_TIMEOUT, 500, MAX_TIMEOUT)
    const graceMs = clamp(Number(data.grace_ms) || DEFAULT_GRACE, 0, 2000)

    // Session for reply capture
    const session = {
      requestId,
      replies: [],
      closed: false
    }

    // Build fakeE
    const fakeE = this._buildFakeE(data, requestId, session)

    try {
      // Bypass black/whitelist and cooldown for CLI events
      const origCheckBlack = loader.checkBlack
      const origCheckLimit = loader.checkLimit
      loader.checkBlack = function (e) {
        if (e.isMiaoCli) return true
        return origCheckBlack.call(this, e)
      }
      loader.checkLimit = function (e) {
        if (e.isMiaoCli) return true
        return origCheckLimit.call(this, e)
      }

      // Execute with timeout
      const result = await Promise.race([
        loader.deal(fakeE),
        sleep(timeoutMs).then(() => '__TIMEOUT__')
      ])

      // Restore monkey patches
      loader.checkBlack = origCheckBlack
      loader.checkLimit = origCheckLimit

      const timedOut = result === '__TIMEOUT__'

      // Grace period for async replies
      if (!timedOut && graceMs > 0) {
        await sleep(graceMs)
      }

      session.closed = true
      fakeE.__cleanup?.()

      this._json(res, 200, {
        success: true,
        replies: session.replies,
        duration_ms: Date.now() - startedAt,
        matched_plugin: fakeE.logFnc || null,
        timed_out: timedOut,
        request_id: requestId
      })
    } catch (err) {
      session.closed = true
      fakeE.__cleanup?.()
      this._json(res, 500, {
        success: false,
        error: `PLUGIN_ERROR: ${err.message}`,
        replies: session.replies,
        duration_ms: Date.now() - startedAt,
        matched_plugin: fakeE.logFnc || null,
        request_id: requestId
      })
    }
  }

  // ==================== POST /api/pause ====================

  _handlePause (_req, res, params) {
    const groupId = params.get('group')
    if (!groupId) {
      return this._json(res, 400, { success: false, error: 'MISSING_GROUP' })
    }

    const game = GameController.getGame(Number(groupId))
    if (!game) {
      return this._json(res, 404, { success: false, error: 'GAME_NOT_FOUND' })
    }

    game._cliPaused = true

    // Clear all known timers on current state
    const state = game.stateMachine?.currentState || game.getCurrentState?.()
    let cleared = 0
    if (state) {
      for (const prop of TIMER_PROPS) {
        if (state[prop]) {
          clearTimeout(state[prop])
          state[prop] = null
          cleared++
        }
      }
    }

    this._json(res, 200, { success: true, paused: true, timers_cleared: cleared })
  }

  // ==================== POST /api/resume ====================

  _handleResume (_req, res, params) {
    const groupId = params.get('group')
    if (!groupId) {
      return this._json(res, 400, { success: false, error: 'MISSING_GROUP' })
    }

    const game = GameController.getGame(Number(groupId))
    if (!game) {
      return this._json(res, 404, { success: false, error: 'GAME_NOT_FOUND' })
    }

    game._cliPaused = false
    this._json(res, 200, { success: true, paused: false })
  }

  // ==================== GET /api/messages ====================

  _handleMessages (_req, res, params) {
    const buf = globalThis.__miaoCliMessages
    const clear = params.get('clear') === 'true'
    const msgs = [...buf]
    if (clear) buf.length = 0

    this._json(res, 200, {
      success: true,
      messages: msgs,
      count: msgs.length
    })
  }

  // ==================== POST /api/restart ====================

  async _handleRestart (_req, res) {
    this._json(res, 200, { success: true, message: 'Bot 正在重启...' })
    logger.info('[miao-cli] 收到重启请求，正在重启...')

    const { spawn } = await import('node:child_process')
    const appPath = path.resolve(process.cwd(), 'app.js')

    setTimeout(() => {
      const child = spawn('node', [appPath], {
        cwd: process.cwd(),
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      })
      child.unref()
      process.exit(0)
    }, 1000)
  }

  // ==================== fakeE Factory ====================

  _buildFakeE (data, requestId, session) {
    const text = data.text
    const userId = String(data.user_id || 10001)
    const groupId = data.group_id ? String(data.group_id) : null
    const isMaster = !!data.is_master
    const nickname = data.sender?.nickname || `CLI用户${userId}`
    const card = data.sender?.card || nickname
    const role = data.sender?.role || 'member'
    const isOwner = role === 'owner'
    const isAdmin = role === 'admin' || isOwner

    const capture = (msg, meta = {}) => {
      const normalized = normalizeMsg(msg)
      const entry = {
        ...normalized,
        channel: meta.channel || 'unknown',
        method: meta.method || 'unknown',
        ts: Date.now()
      }

      // Always write to global buffer (for async game messages)
      const buf = globalThis.__miaoCliMessages
      buf.push(entry)
      if (buf.length > MAX_MSG_BUFFER) buf.splice(0, buf.length - MAX_MSG_BUFFER)

      // Write to session replies if still open
      if (!session.closed) {
        const seq = session.replies.length + 1
        entry.message_id = `miao-cli-${requestId}-${seq}`
        session.replies.push(entry)
      }

      // Log reply to Bot console
      const preview = normalized.type === 'text' ? normalized.content : `[${normalized.type}]`
      logger.info(`[miao-cli] [reply] ${preview}`)

      return { message_id: entry.message_id || `miao-cli-${requestId}-late` }
    }

    const captureReply = async (msg) => {
      return capture(msg, { channel: groupId ? 'group' : 'private', method: 'e.reply' })
    }

    const mockSender = (targetId) => ({
      user_id: targetId,
      nickname: `User${targetId}`,
      sendMsg: async (msg) => capture(msg, { channel: 'private', method: 'bot.pickFriend.sendMsg', target_id: targetId }),
      recallMsg: async () => true,
      makeForwardMsg: async (msgs) => msgs,
      getFileUrl: async () => ''
    })

    const mockGroup = (gid) => ({
      group_id: gid,
      name: `cli-group-${gid}`,
      mute_left: 0,
      sendMsg: async (msg) => capture(msg, { channel: 'group', method: 'group.sendMsg', target_id: gid }),
      recallMsg: async () => true,
      makeForwardMsg: async (msgs) => msgs,
      pickMember: (uid) => ({
        user_id: uid,
        info: { user_id: uid, nickname: `User${uid}`, card: `User${uid}` },
        _info: { user_id: uid },
        is_owner: false,
        is_admin: false
      })
    })

    // Wrap real Bot: use real Bot but override send methods for capture
    const realBot = global.Bot?.[global.Bot?.uin] || global.Bot || {}

    // Mock fl/gl that always report CLI users as friends/group members
    const mockFl = {
      has: () => true,
      get: (id) => mockSender(id),
      size: realBot.fl?.size || 0
    }
    const mockGl = {
      has: () => true,
      get: (gid) => mockGroup(gid),
      size: realBot.gl?.size || 0
    }

    const wrappedBot = {
      ...realBot,
      uin: realBot.uin || 88888,
      nickname: realBot.nickname || 'miao-cli',
      tiny_id: realBot.tiny_id || '',
      fl: mockFl,
      gl: mockGl,
      gml: realBot.gml || new Map(),
      pickFriend: (id) => mockSender(id),
      pickUser: (id) => mockSender(id),
      pickGroup: (gid) => mockGroup(gid),
      sendPrivateMsg: async (id, msg) => capture(msg, { channel: 'private', method: 'bot.sendPrivateMsg', target_id: id }),
      reloadFriendList: async () => true
    }

    // Register wrapped bot so PluginsLoader.deal defines e.bot from it
    const selfId = `miao-cli-${requestId}`
    global.Bot[selfId] = wrappedBot

    const groupObj = groupId ? mockGroup(groupId) : { mute_left: 0, sendMsg: captureReply }
    const friendObj = mockSender(userId)

    const e = {
      test: true,
      isMiaoCli: true,
      self_id: selfId,
      time: Date.now(),
      post_type: 'message',
      message_type: groupId ? 'group' : 'private',
      sub_type: 'normal',
      group_id: groupId ? Number(groupId) : undefined,
      group_name: groupId ? `cli-group-${groupId}` : undefined,
      user_id: Number(userId) || userId,
      user_avatar: '',
      anonymous: null,
      message: [{ type: 'text', text }],
      raw_message: `${text}\n[miao-cli:${requestId}]`,
      font: '微软雅黑',
      sender: {
        user_id: Number(userId) || userId,
        nickname,
        card,
        sex: 'unknown',
        age: 0,
        area: 'unknown',
        level: 1,
        role,
        title: ''
      },
      message_id: `miao-cli-${requestId}`,
      reply: captureReply,
      toString: () => text,

      // Group-specific mocks
      group: groupObj,
      friend: friendObj,

      // Pre-compute flags (dealMsg will also set some of these)
      isGroup: !!groupId,
      isPrivate: !groupId,

      // Member mock for permission checks
      member: groupId ? {
        user_id: Number(userId) || userId,
        group_id: Number(groupId),
        nickname,
        card,
        role,
        is_owner: isOwner,
        is_admin: isAdmin,
        _info: {
          user_id: Number(userId) || userId,
          group_id: Number(groupId),
          nickname,
          card,
          role
        }
      } : undefined
    }

    // isMaster: set on e so dealMsg recognizes it
    if (isMaster) {
      e.isMaster = true
    }

    // Cleanup callback (call after response sent)
    e.__cleanup = () => {
      delete global.Bot[selfId]
    }

    return e
  }

  // ==================== Helpers ====================

  _json (res, status, data) {
    const body = JSON.stringify(data)
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body)
    })
    res.end(body)
  }
}

// ==================== Utilities ====================

// PluginsLoader singleton — lazy-loaded once via dynamic import
let _loader = null
function await_loader () {
  return _loader
}

// Bootstrap: load PluginsLoader after module init
import('../../../lib/plugins/loader.js')
  .then(m => { _loader = m.default })
  .catch(() => {})

function normalizeMsg (msg) {
  if (msg === null || msg === undefined) {
    return { type: 'text', content: '' }
  }
  if (typeof msg === 'string') {
    return { type: 'text', content: msg }
  }
  if (Buffer.isBuffer(msg)) {
    return { type: 'buffer', bytes: msg.length }
  }
  if (Array.isArray(msg)) {
    const parts = msg.map(seg => {
      if (typeof seg === 'string') return seg
      if (seg?.type === 'text') return seg.text || ''
      if (seg?.type === 'image') return '[图片]'
      if (seg?.type === 'at') return `[@${seg.qq || seg.id || ''}]`
      if (seg?.type === 'face') return `[表情${seg.id || ''}]`
      return JSON.stringify(seg).slice(0, 200)
    })
    return { type: 'text', content: parts.join('') }
  }
  if (msg?.type === 'image' || msg?.file) {
    return { type: 'image', file: Buffer.isBuffer(msg.file) ? `<Buffer ${msg.file.length} bytes>` : String(msg.file || '').slice(0, 200) }
  }
  // Generic object
  try {
    const s = JSON.stringify(msg)
    return { type: 'object', content: s.length > 4000 ? s.slice(0, 4000) + '...' : s }
  } catch {
    return { type: 'object', content: String(msg).slice(0, 1000) }
  }
}

function readBody (req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        req.destroy()
        reject(new Error('BODY_TOO_LARGE'))
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function clamp (v, min, max) {
  return Math.min(Math.max(v, min), max)
}

function formatDate (d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
