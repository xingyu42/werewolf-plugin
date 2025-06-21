# 狼人杀插件

**版本：** v0.8.1
**状态：** 生产就绪
**最后更新：** 2025-06-21

一个为 Miao-Yunzai 机器人框架开发的高质量狼人杀游戏插件，经过全面重构和优化。

## ✨ 功能特性

### 🎮 游戏功能
- **完整的狼人杀游戏流程**：支持标准狼人杀规则
- **多种角色支持**：狼人、预言家、女巫、猎人、守卫、村民
- **智能游戏状态管理**：自动状态转换和验证
- **灵活的游戏配置**：可自定义人数、时间等参数

### 🏗️ 技术特性
- **模块化架构**：清晰的职责分离和依赖管理
- **统一错误处理**：用户友好的错误消息和完善的日志
- **高性能缓存**：智能缓存系统提升响应速度

- **完善的文档**：详细的API文档和开发指南

### 🛡️ 质量保证
- **内存安全**：完善的资源管理防止内存泄漏
- **输入验证**：严格的参数验证和边界检查
- **错误恢复**：自动错误处理和状态恢复
- **性能监控**：内置性能指标和健康检查

## 🚀 快速开始

### 安装

1. 将插件文件放置到 Miao-Yunzai 的 plugins 目录下
2. 安装依赖（如果需要）：
   ```bash
   cd plugins/werewolf-plugin
   pnpm install
   ```
3. 重启机器人
4. 发送 `#狼人杀帮助` 查看使用说明

### 基本使用

```
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

```
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


## 📚 文档

- **[架构文档](docs/architecture.md)** - 系统架构和设计原理
- **[API参考](docs/api-reference.md)** - 完整的API文档
- **[开发指南](docs/development-guide.md)** - 开发规范和最佳实践
- **[故障排除](docs/troubleshooting.md)** - 常见问题和解决方案
- **[代码审查报告](docs/code-review-report.md)** - 详细的质量分析报告

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

### 技术相关
- **Q: 出现内存泄漏？**
  A: 查看[故障排除指南](docs/troubleshooting.md)

- **Q: 如何贡献代码？**
  A: 参考[开发指南](docs/development-guide.md)

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

**维护状态：** 积极维护中
**支持版本：** Node.js ≥16.0.0
