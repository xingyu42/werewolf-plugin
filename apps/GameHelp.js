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
    // 加载帮助配置
    let helpConfig = await this.getHelpConfig();
    
    // 渲染帮助页面
    const renderData = {
      helpCfg: helpConfig.helpCfg,
      helpGroup: this.processHelpGroups(helpConfig.helpList, e),
      element: 'default'
    };

    try {
      // 使用 PuppeteerManager 渲染页面
      const image = await PuppeteerManager.render("help/help", renderData, {
        e,
        scale: 1.2
      });
      
      // 发送图片消息
      await this.reply(image);
      return true;
    } catch (err) {
      logger.error(`[狼人杀插件] 帮助页面渲染失败：${err}`);
      return false;
    }
  }

  async getHelpConfig() {
    // 获取默认配置
    let defaultConfig = await this.getDefaultConfig();
    
    // 获取用户自定义配置（如果存在）
    let userConfig = await this.getUserConfig();
    
    return {
      helpCfg: { ...defaultConfig.helpCfg, ...userConfig.helpCfg },
      helpList: userConfig.helpList || defaultConfig.helpList
    };
  }

  processHelpGroups(helpList, e) {
    let helpGroup = [];

    for (let group of helpList) {
      // 检查权限
      if (group.auth === 'master' && !e.isMaster) {
        continue;
      }

      // 处理图标
      group.list = group.list.map(help => {
        let icon = help.icon * 1;
        if (!icon) {
          help.css = 'display:none';
        } else {
          let x = (icon - 1) % 10;
          let y = (icon - x - 1) / 10;
          help.css = `background-position:-${x * 50}px -${y * 50}px`;
        }
        return help;
      });

      helpGroup.push(group);
    }

    return helpGroup;
  }

  async getDefaultConfig() {
    return (await import('../config/system/help_default.js')).default;
  }

  async getUserConfig() {
    try {
      return (await import('../config/help.js')).default;
    } catch (e) {
      return { helpCfg: {}, helpList: [] };
    }
  }
}
