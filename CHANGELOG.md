# 更新日志

所有关于狼人杀插件的显著变更都将记录在此文件中。

## [未发布]

### 优化

- 重构游戏配置文件格式，提高可读性和可维护性
  - 将 `modes.yaml` 改为使用键值对形式定义角色数量，替代原有的数组列表
  - 增加配置名称和描述字段，便于识别不同游戏模式
  - 添加配置验证，确保角色总数与玩家数量匹配
- 重构角色配置系统，提高代码一致性和可维护性
  - 修改 `GameTemplates.js` 以从 `modes.yaml` 读取配置，替代硬编码方式
  - 添加配置缓存机制，提高性能
  - 移除 `GameManager.js` 中冗余的 `getRoleList()` 方法
  - 统一使用 `RoleConfigurator.generate()` 进行角色分配
  - 添加完整的测试套件，确保功能正常
- modes.yaml新格式支持自定义，详细说明和注释已补充至README和GameTemplates.js文件头部。

## [0.2] - 2025-06-12

### 新增

- 引入Jest测试框架，添加单元测试支持
- 为核心组件创建详细的测试用例
  - 状态机测试（StateMachine.test.js, StateMachine.detailed.test.js）
  - 胜利条件检查测试（VictoryChecker.test.js, VictoryChecker.detailed.test.js）
  - 错误处理测试（GameError.test.js）
  - 游戏核心逻辑测试（GameSimple.test.js）
  - 事件通信机制测试（GameEventHandlerSimple.test.js）
- 创建可复用的测试模拟对象
  - MockGame：模拟游戏实例
  - MockCommunicationHandle：模拟QQ通信句柄
  - MockPuppeteer：模拟截图功能
- 更新测试文档，详细说明测试目的和运行方法

### 优化

- 完善测试目录结构，使测试组织更加清晰
- 优化Jest配置，支持ES Modules
- 改进测试环境设置，解决外部依赖问题

## [0.1] - 2025-03-23

### 新增

- 基础游戏框架搭建
- 游戏房间系统
- 角色分配系统
- 基础游戏流程控制
- 投票系统实现
- 游戏指令系统

### 优化

- 优化游戏状态展示
- 改进错误提示信息

### 修复

- 修复游戏结束时状态未正确重置的问题
- 修复角色技能使用判定逻辑

### 初始化

- 项目初始化
- 基础目录结构搭建
- 配置文件模板
- 开发文档编写
