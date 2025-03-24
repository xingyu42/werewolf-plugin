/* eslint-disable import/no-unresolved */
import { update as Update } from "../../other/update.js"

export class WerewolfUpdate extends plugin {
  constructor() {
    super({
      name: "狼人杀更新插件",
      event: "message",
      priority: 1000,
      rule: [
        {
          reg: "^#*狼人杀(插件)?(强制)?更新$",
          fnc: "update"
        },
        {
          reg: "^#?狼人杀(插件)?更新日志$",
          fnc: "update_log"
        }
      ]
    })
  }

  async update(e = this.e) {
    if (!e.isMaster) return e.reply("你没有权限更新狼人杀插件")
      e.msg = `#${e.msg.includes("强制") ? "强制" : ""}更新werewolf-plugin`
      const up = new Update(e)
      up.e = e
      return up.update()
  }

  async update_log() {
    // eslint-disable-next-line new-cap
    let Update_Plugin = new Update()
    Update_Plugin.e = this.e
    Update_Plugin.reply = this.reply
    
    let Plugin_Name = "werewolf-plugin"
    if (Update_Plugin.getPlugin(Plugin_Name)) {
      this.e.reply(await Update_Plugin.getLog(Plugin_Name))
    }
    return true
  }
}
