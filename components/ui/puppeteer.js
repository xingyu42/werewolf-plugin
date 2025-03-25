import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs'
import _ from 'lodash'
import Renderer from '../../../../lib/renderer/loader.js'

const _path = process.cwd()
const renderer = Renderer.getRenderer()

/**
 * 狼人杀插件的 Puppeteer 管理器
 * 负责浏览器实例管理和渲染功能
 */
class Puppeteer {
  constructor() {
    this.browser = null
    this.lock = false
    this.shoting = []
    /** 截图数达到时重启浏览器 避免生成速度越来越慢 */
    this.restartNum = 100
    /** 截图次数 */
    this.renderNum = 0
    this.config = {
      executablePath: '',
      puppeteerWS: '',
      headless: 'new',
      args: [
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--no-zygote',
        '--font-render-hinting=medium',
        '--disable-application-cache',
        '--disable-dev-shm-usage', // 禁用/dev/shm使用
        '--disable-extensions', // 禁用扩展
        '--disable-infobars', // 禁用信息栏
        '--disable-notifications', // 禁用通知
        '--disable-offline-load-stale-cache', // 禁用离线加载过期缓存
        '--dns-prefetch-disable', // 禁用DNS预取
        '--enable-features=NetworkService', // 启用网络服务特性
        '--enable-automation' // 启用自动化
      ]
    }
  }

  /**
   * 初始化浏览器实例
   * @returns {Promise<boolean|object>} 浏览器实例或失败状态
   */
  async browserInit() {
    if (this.browser) return this.browser
    if (this.lock) return false
    this.lock = true

    logger.mark('[狼人杀插件] Puppeteer 启动中...')
    const browserURL = 'http://127.0.0.1:51777'
    try {
      // 尝试连接已存在的浏览器实例
      this.browser = await puppeteer.connect({ browserURL })
    } catch (e) {
      // 连接失败，启动新的浏览器实例
      this.browser = await puppeteer.launch(this.config).catch((err) => {
        logger.error(err.toString())
        if (String(err).includes('correct Chromium')) {
          logger.error('没有正确安装Chromium，可以尝试执行安装命令：node ./node_modules/puppeteer/install.js')
        }
      })
    }
    this.lock = false

    if (!this.browser) {
      logger.error('[狼人杀插件] Puppeteer 启动失败')
      return false
    }

    logger.mark('[狼人杀插件] Puppeteer 启动成功')

    /** 监听Chromium实例是否断开 */
    this.browser.on('disconnected', () => {
      logger.info('[狼人杀插件] Chromium实例关闭或崩溃！')
      this.browser = null
    })
    return this.browser
  }

  /**
   * 创建新页面
   * @returns {Promise<Page>} 页面实例
   */
  async newPage() {
    if (!(await this.browserInit())) {
      return false
    }
    return await this.browser.newPage().catch((err) => {
      logger.error('[狼人杀插件] 创建页面失败：' + err)
      return false
    })
  }

  /**
   * 关闭页面
   * @param {Page} page 页面实例
   */
  async closePage(page) {
    if (page) {
      await page.close().catch((err) => logger.error('[狼人杀插件] 页面关闭出错：' + err))
      this.renderNum += 1
      this.restart()
    }
  }

  /**
   * 关闭浏览器
   */
  async close() {
    if (this.browser) {
      await this.browser.close().catch((err) => logger.error('[狼人杀插件] 浏览器关闭出错：' + err))
      this.browser = null
    }
  }

  /**
   * 重启浏览器（当截图次数达到阈值时）
   */
  restart() {
    /** 截图超过重启数时，自动关闭重启浏览器，避免生成速度越来越慢 */
    if (this.renderNum % this.restartNum === 0) {
      if (this.shoting.length <= 0) {
        setTimeout(async () => {
          await this.close()
          logger.mark('[狼人杀插件] Puppeteer 关闭重启...')
        }, 100)
      }
    }
  }

  /**
   * 渲染HTML模板
   * @param {string} tplPath 模板路径，相对于plugin resources目录
   * @param {Object} data 渲染数据
   * @param {Object} cfg 渲染配置
   * @returns {Promise<import('icqq').segment.image>} 图片消息段
   */
  async render(tplPath, data = {}, cfg = {}) {
    // 处理传入的path
    tplPath = tplPath.replace(/.html$/, "")
    let paths = _.filter(tplPath.split("/"), (p) => !!p)
    tplPath = paths.join("/")

    // 创建临时目录
    const tempDir = path.join(_path, 'temp', 'html', 'werewolf-plugin', tplPath)
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    // 计算资源路径
    let pluResPath = `../../../${_.repeat("../", paths.length)}plugins/werewolf-plugin/resources/`

    // 渲染数据
    data = {
      sys: {
        scale: 1.2
      },
      _plugin: `werewolf-plugin`,
      _htmlPath: tplPath,
      pluResPath,
      tplFile: `./plugins/werewolf-plugin/resources/${tplPath}.html`,
      saveId: data.saveId || data.save_id || paths[paths.length - 1],

      // 截图参数
      imgType: 'jpeg',
      quality: 90,  // 图片质量
      omitBackground: false,
      pageGotoParams: {
        waitUntil: "networkidle0"
      },

      ...data
    }

    // 处理beforeRender回调
    if (cfg.beforeRender) {
      data = cfg.beforeRender({ data }) || data
    }

    // 调用渲染器进行截图
    let base64 = await renderer.screenshot(`werewolf-plugin/${tplPath}`, data)
    let ret = true
    if (base64) {
      ret = await e.reply(base64)
    }
    return ret || true
  }
}

export default new Puppeteer()
