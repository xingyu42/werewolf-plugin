# 狼人杀插件

一个为 Miao-Yunzai 机器人框架开发的高质量狼人杀游戏插件，经过全面重构和优化。

## 🚀 快速开始

### 安装

   ```bash
   git clone https://github.com/xingyu42/werewolf-plugin.git ./plugins/werewolf-plugin
   ```

**系统要求：**

- Node.js ≥16.0.0
- Miao-Yunzai 框架
- ~~Redis服务器~~ （v0.9.0已移除此要求）

### 基本使用

```txt
#狼人杀           # 创建游戏房间
#加入游戏         # 加入当前游戏
#退出游戏         # 退出当前游戏
#开始游戏         # 开始游戏（需要足够玩家）
#游戏状态         # 查看当前游戏状态
#狼人杀帮助       # 查看详细帮助
```

### 游戏流程

1. **创建房间**：群主或管理员发送 `#狼人杀`
2. **玩家加入**：玩家发送 `#加入游戏`
3. **开始游戏**：人数足够后发送 `#开始游戏`
4. **游戏进行**：按照系统提示进行游戏
5. **游戏结束**：系统自动判断胜负并清理资源

## 📁 项目结构

```txt
werewolf-plugin/
├── model/                  # 核心业务逻辑
│   ├── core/              # 核心类（Game、ErrorHandler等）
│   ├── managers/          # 管理器（PlayerManager、StateManager）
│   ├── roles/             # 角色系统
│   ├── utils/             # 工具类
│   └── configurators/     # 配置生成器
├── components/            # 组件和工具
├── apps/                  # 应用入口点

├── docs/                  # 文档
└── config/               # 配置文件
```

## 🔧 配置说明

配置文件位于 `config` 目录下：

- `game.yaml` - 游戏基础配置
- `roles.yaml` - 角色配置
- `modes.yaml` - 游戏模式配置

### 自定义配置

```yaml
# config/game.yaml
minPlayers: 6
maxPlayers: 12
speakTimeLimit: 60
voteTimeLimit: 30
```

## ❓ 常见问题

### 游戏相关

- **Q: 游戏无法开始？**
  A: 请确保房间人数达到最低要求(默认6人)

- **Q: 如何修改游戏配置？**
  A: 编辑 config 目录下对应的配置文件

## 📈 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)

## 🤝 贡献指南

1. Fork 本仓库
2. 创建新分支: `git checkout -b feature/your-feature`
3. 遵循[开发指南](docs/development-guide.md)编写代码
4. 提交更改: `git commit -am 'Add some feature'`
5. 推送分支: `git push origin feature/your-feature`
6. 提交 Pull Request

## 📄 许可证

MIT License

## 🙏 致谢

- [Miao-yunzai](https://github.com/yoimiya-kokomi/Miao-Yunzai) - 基础框架支持
- 所有贡献者和用户的支持
- 开源社区的最佳实践指导

---
