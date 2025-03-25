import PuppeteerManager from '../components/ui/puppeteer.js'

export class GameHelp extends plugin {
  constructor() {
    super({
      name: "[狼人杀]帮助",
      dsc: "狼人杀帮助",
      event: "message",
      priority: 5000,
      rule: [
        { reg: "^#狼人杀帮助$", fnc: "showHelp" },
      ],
    });
  }

  async showHelp(e) {
    // 默认配置结构
  }
}