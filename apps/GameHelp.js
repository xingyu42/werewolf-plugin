import { Data, Puppeteer } from '../components/services.js'
import lodash from 'lodash'

export class GameHelp extends plugin {
  constructor () {
    super({
      name: '[狼人杀]帮助',
      dsc: '狼人杀帮助',
      event: 'message',
      priority: 5000,
      rule: [
        { reg: '^#?狼人杀帮助$', fnc: 'showHelp' }
      ]
    })
  }

  async _prepareHelpData () {
    const { diyCfg, sysCfg } = await Data.importCfg('help')

    const helpConfig = lodash.defaults(
      diyCfg.helpCfg || {},
      sysCfg.helpCfg
    )
    const helpList = diyCfg.helpList || sysCfg.helpList

    const helpGroup = []
    for (const group of helpList) {
      if (group.auth && group.auth === 'master' && !this.e.isMaster) {
        continue
      }
      for (const help of group.list) {
        const icon = help.icon * 1

        if (!icon) {
          help.css = 'display:none'
        } else {
          const x = (icon - 1) % 10
          const y = (icon - x - 1) / 10
          help.css = `background-position:-${x * 50}px -${y * 50}px`
        }
      }
      helpGroup.push(group)
    }
    return { helpConfig, helpGroup }
  }

  async showHelp () {
    const { helpConfig, helpGroup } = await this._prepareHelpData()

    return await Puppeteer.render('help/help', {
      helpCfg: helpConfig,
      helpGroup,
      colCount: 3,
      element: 'default'
    }, {
      e: this.e,
      scale: 2.0
    })
  }
}
