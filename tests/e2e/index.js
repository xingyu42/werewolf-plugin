/**
 * @file index.js
 * @description E2E 测试工具统一导出
 * @module tests/e2e
 */

export { MockBot, MockPlayer } from './MockBot.js'
export { MessageRouter } from './MessageRouter.js'
export { TestOrchestrator } from './TestOrchestrator.js'
export { TimerController, timerController, installTimerMock, uninstallTimerMock } from './TimerMock.js'
