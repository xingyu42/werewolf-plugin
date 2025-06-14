# 更新日志

## [0.6.0] - 2025-06-15
### 重构
- **核心逻辑拆分:** 完全重构了项目核心 `GameManager`，将其拆分为多个专注于单一职责的服务：
  - `GameRegistry`: 全局游戏实例的注册与管理。
  - `GameLobby`: 游戏房间（玩家加入、离开、角色分配）的管理。
  - `PlayerQueryService`: 封装了所有与玩家状态查询相关的复杂逻辑。
  - `ActionHandler`: 统一处理和验证玩家的所有游戏内行为 (`!ww action`)。
- **状态管理抽象:** 从核心 `Game.js` 中提取出通用的 `StateMachine` 类，使游戏状态的管理更加清晰和独立。
- **依赖注入:** 在 `Game.js` 中引入了依赖注入，使其依赖的 `PlayerQueryService` 和 `StateMachine` 等服务在外部创建和注入，极大地提高了模块化和可测试性。
- **入口点更新:** 全面更新了所有应用入口点 (`apps/*.js`)，以适应新的服务化架构，确保游戏创建、角色分配和动作处理流程的正确性。

### 修复
- 修复了在新的服务化架构中，`PlayerQueryService` 无法访问角色配置的问题。
- 修复了游戏房间在玩家加入前就被销毁的设计缺陷。
- 清理了重构后各文件中残留的未使用导入和冗余方法。

## [0.5.0] - 2025-06-15

### 优化

- 重构游戏行动处理逻辑，引入统一的 `ActionHandler` 服务
  - 抽象并简化了玩家行动前的通用验证（如存活状态、游戏阶段检查）
  - 显著减少 `GameAction.js` 中的重复代码，提高代码的可读性和可维护性
- 优化 `GameHelp.js` 的代码结构，提高封装性
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
