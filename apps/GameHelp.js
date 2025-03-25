import { Data, Puppeteer } from '../components/index.js'
import lodash from 'lodash'
export class GameHelp extends plugin {
  constructor() {
    super({
      name: "[狼人杀]帮助",
      dsc: "狼人杀帮助",
      event: "message",
      priority: 5000,
      rule: [
        { reg: "^#狼人杀帮助$", fnc: "message" },
      ],
    });
  }

  async message() {
    return await help(this.e)
  }
}
  async function help(e) {
    let custom = {};
    let help = {};

    let { diyCfg, sysCfg } = await Data.importCfg('help');
    custom = help;

    let helpConfig = lodash.defaults(diyCfg.helpCfg || {}, custom.helpCfg, sysCfg.helpCfg);

    let helpList = diyCfg.helpList || custom.helpList || sysCfg.helpList;

    let helpGroup = [];

    for (let group of helpList) {
        if (group.auth && group.auth === 'master' && !e.isMaster) {
            continue;
        }
        for (let help of group.list) {
            let icon = help.icon * 1;

            if (!icon) {
                help.css = 'display:none';
            } else {
                let x = (icon - 1) % 10;
                let y = (icon - x - 1) / 10;
                help.css = `background-position:-${x * 50}px -${y * 50}px`;
            }
        }
        helpGroup.push(group);
    }

    return await Puppeteer.render('help/help', {
        helpCfg: helpConfig,
        helpGroup,
        colCount: 3,
        element: 'default',
    }, {
        e,
        scale: 2.0,
    });
  }