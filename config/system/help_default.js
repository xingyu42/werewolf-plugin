/*
* 此配置文件为系统使用，请勿修改，否则可能无法正常使用
*
* 如需自定义配置请复制修改上一级help_default.js
*
* */

export const helpCfg = {
  title: '狼人杀帮助',
  subTitle: 'Yunzai-Bot & Werewolf-Plugin',
  columnCount: 3, // 每行显示的指令数量
  colWidth: 265, // 每列宽度
  theme: 'all', // 主题
  themeExclude: ['default'], // 排除主题
  style: {
    fontColor: '#ceb78b', // 字体颜色
    descColor: '#eee', // 描述颜色
    contBgColor: 'rgba(6, 21, 31, .5)', // 内容背景颜色
    contBgBlur: 3, // 内容背景模糊
    headerBgColor: 'rgba(6, 21, 31, .4)', // 头部背景颜色
    rowBgColor1: 'rgba(6, 21, 31, .2)', // 行背景颜色1
    rowBgColor2: 'rgba(6, 21, 31, .35)' // 行背景颜色2
  }
}

export const helpList = [{
  group: '狼人杀开局',
  list: [{
    icon: 61,
    title: '#创建狼人杀',
    desc: '创建狼人杀'
  }, {
    icon: 63,
    title: '#加入狼人杀',
    desc: '加入狼人杀'
  }, {
    icon: 66,
    title: '#开始狼人杀',
    desc: '开始狼人杀'
  }, {
    icon: 65,
    title: '#结束狼人杀',
    desc: '结束狼人杀'
  }]
}, {
  group: '狼人杀行动',
  list: [{
    icon: 58,
    title: '#投票*号',
    desc: '投票几号出局'
  }, {
    icon: 59,
    title: '#弃票',
    desc: '放弃投票'
  },{
    icon: 59,
    title: '#结束遗言',
    desc: '结束遗言'
  }, {
    icon: 60,
    title: '#竞选警长',
    desc: '竞选警长'
  }, {
    icon: 88,
    title: '#警长移交*号',
    desc: '警长移交'
  }, {
    icon: 53,
    title: '#放弃移交',
    desc: '放弃移交警长'
  }, {
    icon: 56,
    title: '#支持*号',
    desc: '支持*号竞选警长'
  }, {
    icon: 78,
    title: '#讨论*',
    desc: '狼人讨论室'
  }, {
    icon: 77,
    title: '#结束发言',
    desc: '结束发言'
  }]
}, {
  group: '狼人杀角色行动',
  desc: '',
  list: [{
    icon: 15,
    title: '#守护*号',
    desc: '守护*号'
  }, {
    icon: 5,
    title: '#反杀*号',
    desc: '反杀*号'
  }, {
    icon: 10,
    title: '#查验*号',
    desc: '查验*号'
  }, {
    icon: 22,
    title: '#毒杀*号',
    desc: '毒杀*号'
  }, {
    icon: 86,
    title: '#救人',
    desc: '救人'
    }, {
    icon: 11,
    title: '#放弃',
    desc: '放弃使用药水'
  }, {
    icon: 12,
    title: '#刀*号',
    desc: '刀*号'
  }, {
    icon: 13,
    title: '#自爆',
    desc: '狼人自爆跳夜晚'
  }, {
    icon: 14,
    title: '#空刀',
    desc: '狼人空刀'
  }]
}, {
  group: '管理命令，仅管理员可用',
  auth: 'master',
  list: [{
    icon: 85,
    title: '#狼人杀更新',
    desc: '更新狼人杀插件'
  }]
}]

export const isSys = true
