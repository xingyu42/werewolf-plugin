export default {
  // 帮助配置
  helpCfg: {
    title: '狼人杀游戏帮助',
    subTitle: '指令说明',
    columnCount: 3,
    colWidth: 265,
    theme: 'default',
    themeExclude: []
  },
  // 帮助列表
  helpList: [
    {
      group: '基础指令',
      list: [
        {
          icon: 1,
          title: '#狼人杀帮助',
          desc: '显示帮助信息'
        },
        {
          icon: 2,
          title: '#加入游戏',
          desc: '加入狼人杀游戏'
        },
        {
          icon: 3,
          title: '#退出游戏',
          desc: '退出当前游戏'
        },
        {
          icon: 4,
          title: '#开始游戏',
          desc: '开始狼人杀游戏'
        }
      ]
    },
    {
      group: '游戏阶段指令',
      list: [
        {
          icon: 5,
          title: '#投票 @玩家',
          desc: '投票处决玩家'
        },
        {
          icon: 6,
          title: '#技能 @玩家',
          desc: '对目标玩家使用角色技能'
        },
        {
          icon: 7,
          title: '#跳身份 xxx',
          desc: '声明自己的身份'
        }
      ]
    },
    {
      group: '管理指令',
      auth: 'master',
      list: [
        {
          icon: 8,
          title: '#结束游戏',
          desc: '强制结束当前游戏'
        },
        {
          icon: 9,
          title: '#踢出 @玩家',
          desc: '将玩家踢出游戏'
        }
      ]
    }
  ]
}
