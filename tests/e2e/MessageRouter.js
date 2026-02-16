/**
 * @file MessageRouter.js
 * @description 消息路由器，模拟 apps 层的正则匹配和分发
 * @module tests/e2e/MessageRouter
 *
 * 核心功能：
 * - 解析消息并匹配命令规则
 * - 分发到对应的 Controller 方法
 */

import { GameController } from '../../controllers/GameController.js'
import { ActionController } from '../../controllers/ActionController.js'

/**
 * 命令路由规则
 * 与 apps/ 层保持一致
 */
const ROUTES = [
  // GameStart 路由
  { pattern: /^#创建(狼人杀|lrs)$/, handler: (e) => GameController.createGame(e) },
  { pattern: /^#加入(狼人杀|lrs)$/, handler: (e) => GameController.joinGame(e) },
  { pattern: /^#开始(狼人杀|lrs)$/, handler: (e) => GameController.startGame(e) },
  { pattern: /^#结束(狼人杀|lrs)$/, handler: (e) => GameController.endGame(e) },

  // GameAction 路由
  { pattern: /^#投票(\d+)号$/, handler: (e) => ActionController.vote(e) },
  { pattern: /^#弃票$/, handler: (e) => ActionController.abstain(e) },
  { pattern: /^#结束遗言$/, handler: (e) => ActionController.handleSkip(e) },
  { pattern: /^#竞选警长$/, handler: (e) => ActionController.sheriffElect(e) },
  { pattern: /^#警长移交(\d+)号$/, handler: (e) => ActionController.sheriffTransfer(e) },
  { pattern: /^#放弃移交$/, handler: (e) => ActionController.giveupTransfer(e) },
  { pattern: /^#支持(\d+)号$/, handler: (e) => ActionController.support(e) },
  { pattern: /^#讨论(.*)$/, handler: (e) => ActionController.wolfDiscuss(e) },
  { pattern: /^#结束发言$/, handler: (e) => ActionController.endSpeech(e) },

  // GameRoles 路由
  { pattern: /^#守护(\d+)号$/, handler: (e) => ActionController.roleAction(e, 'guard') },
  { pattern: /^#查验(\d+)号$/, handler: (e) => ActionController.roleAction(e, 'check') },
  { pattern: /^#毒杀(\d+)号$/, handler: (e) => ActionController.roleAction(e, 'poison') },
  { pattern: /^#救人$/, handler: (e) => ActionController.roleAction(e, 'save') },
  { pattern: /^#跳过$/, handler: (e) => ActionController.roleAction(e, 'skip') },
  { pattern: /^#刀(\d+)号$/, handler: (e) => ActionController.roleAction(e, 'kill') },
  { pattern: /^#开枪(\d+)号$/, handler: (e) => ActionController.roleAction(e, 'shoot') }
]

/**
 * 消息路由器类
 */
export class MessageRouter {
  constructor () {
    this.routes = [...ROUTES]
    this.beforeHooks = []
    this.afterHooks = []
    this.unhandledCallback = null
  }

  /**
   * 添加自定义路由
   */
  addRoute (pattern, handler) {
    this.routes.push({ pattern, handler })
    return this
  }

  /**
   * 添加前置钩子
   */
  before (hook) {
    this.beforeHooks.push(hook)
    return this
  }

  /**
   * 添加后置钩子
   */
  after (hook) {
    this.afterHooks.push(hook)
    return this
  }

  /**
   * 设置未匹配消息的回调
   */
  onUnhandled (callback) {
    this.unhandledCallback = callback
    return this
  }

  /**
   * 分发消息到对应处理器
   * @param {object} event 事件对象
   * @returns {Promise<{matched: boolean, result: any}>}
   */
  async dispatch (event) {
    const msg = event.msg || event.message || ''

    // 执行前置钩子
    for (const hook of this.beforeHooks) {
      await hook(event)
    }

    // 查找匹配的路由
    for (const route of this.routes) {
      const match = msg.match(route.pattern)
      if (match) {
        try {
          const result = await route.handler(event)
          // 执行后置钩子
          for (const hook of this.afterHooks) {
            await hook(event, { matched: true, result, pattern: route.pattern })
          }
          return { matched: true, result, pattern: route.pattern }
        } catch (error) {
          console.error(`[MessageRouter] Handler error for pattern ${route.pattern}:`, error)
          throw error
        }
      }
    }

    // 未匹配任何路由
    if (this.unhandledCallback) {
      await this.unhandledCallback(event, msg)
    }

    // 执行后置钩子
    for (const hook of this.afterHooks) {
      await hook(event, { matched: false, result: null })
    }

    return { matched: false, result: null }
  }

  /**
   * 创建消息处理函数（用于注入 MockBot）
   */
  createHandler () {
    return (event) => this.dispatch(event)
  }

  /**
   * 获取所有已注册的路由模式
   */
  getPatterns () {
    return this.routes.map(r => r.pattern.toString())
  }
}

export default MessageRouter
