# 狼人杀游戏插件

## 项目简介

这是一个基于 Miao-yunzai 的狼人杀游戏插件，旨在提供一个易于使用和维护的在线游戏体验。本插件支持在QQ群内进行狼人杀游戏，具有角色分配、游戏流程控制等功能。

## 功能特性

- 支持多个群聊同时进行
- 丰富的角色系统
- 完整的游戏流程控制
- 简单易用的指令系统

## 安装说明

1. 确保已安装 Miao-yunzai

2. 克隆本项目：

    ```bash
    git clone https://github.com/xingyu42/werewolf-plugin.git ./plugins/werewolf-plugin
    ```

3. 重启 Miao-yunzai

## 使用方法

### 基础指令

- `#狼人杀帮助` - 显示帮助信息
- `#创建狼人杀` - 创建新游戏房间
- `#加入狼人杀` - 加入当前房间
- `#开始狼人杀` - 开始游戏(仅房主可用)
- `#结束狼人杀` - 退出当前游戏

## 配置说明

配置文件位于 `config` 目录下：

- `config.js` - 基础配置
- `role.js` - 角色配置
- `game.js` - 游戏规则配置

## 常见问题

1. Q: 游戏无法开始？
   A: 请确保房间人数达到最低要求(默认6人)

2. Q: 如何修改游戏配置？
   A: 编辑 config 目录下对应的配置文件

## 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)

## 开发说明

本项目使用 ES Module 规范开发，主要目录结构：

- `apps/` - 核心功能模块
- `components/` - 组件
- `config/` - 配置文件
- `model/` - 数据模型
- `resources/` - 资源文件

## 贡献指南

1. Fork 本仓库
2. 创建新分支: `git checkout -b feature/your-feature`
3. 提交更改: `git commit -am 'Add some feature'`
4. 推送分支: `git push origin feature/your-feature`
5. 提交 Pull Request

## 许可证

MIT License

## 致谢

- [Miao-yunzai](https://github.com/yoimiya-kokomi/Miao-Yunzai) - 基础框架支持
- 所有贡献者和用户
