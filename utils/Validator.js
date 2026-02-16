/**
 * @file ValidationUtils.js
 * @description 统一验证工具类，提供可复用的验证逻辑
 * @module model/core/ValidationUtils
 *
 * @input ErrorHandler, GameError
 * @output ValidationUtils - 验证工具类
 * @pos 核心层 - 验证工具
 *
 * @dependencies
 * - ./ErrorHandler.js - 错误处理
 * - ./GameError.js - 游戏错误
 */
import { ErrorHandler } from './ErrorHandler.js'
import { GameError } from './GameError.js'

/**
 * 验证选项接口
 * @typedef {Object} PlayerValidationOptions
 * @property {boolean} [checkAlive=false] - 是否检查玩家存活状态
 * @property {boolean} [checkRole=false] - 是否检查角色
 * @property {string} [requiredRole=null] - 要求的角色名称
 * @property {boolean} [allowSelf=true] - 是否允许自己作为目标
 */

/**
 * 目标验证器函数类型
 * @typedef {function} TargetValidator
 * @param {Object} target - 目标对象
 * @param {Object} context - 验证上下文
 * @returns {boolean} 验证结果
 */

export class Validator {
  static errorHandler = new ErrorHandler(global.logger || console)

  /**
   * 统一玩家验证
   * @param {Object} player - 玩家对象
   * @param {PlayerValidationOptions} options - 验证选项
   * @returns {{isValid: boolean, error?: GameError}} 验证结果
   */
  static validatePlayer (player, options = {}) {
    const {
      checkAlive = false,
      checkRole = false,
      requiredRole = null
    } = options

    try {
      // 基础空值检查
      if (!player) {
        return {
          isValid: false,
          error: new GameError('玩家对象为空', 'E1101')
        }
      }

      // 验证玩家对象结构
      if (typeof player !== 'object') {
        return {
          isValid: false,
          error: new GameError('无效的玩家对象', 'E1100')
        }
      }

      // 验证必要属性
      const requiredProps = ['id']
      if (checkAlive) requiredProps.push('isAlive')
      if (checkRole) requiredProps.push('role')

      for (const prop of requiredProps) {
        if (!Object.prototype.hasOwnProperty.call(player, prop)) {
          return {
            isValid: false,
            error: new GameError(`玩家对象缺少必要属性: ${prop}`, 'E1100')
          }
        }
      }

      // 检查存活状态
      if (checkAlive) {
        if (typeof player.isAlive !== 'boolean') {
          return {
            isValid: false,
            error: new GameError('玩家存活状态无效', 'E1100')
          }
        }

        if (!player.isAlive) {
          return {
            isValid: false,
            error: new GameError('玩家已死亡', 'E1103')
          }
        }
      }

      // 检查角色
      if (checkRole && requiredRole) {
        if (player.role !== requiredRole) {
          return {
            isValid: false,
            error: new GameError(`角色不匹配，需要: ${requiredRole}`, 'E1402')
          }
        }
      }

      return { isValid: true }
    } catch (error) {
      return {
        isValid: false,
        error: new GameError(`玩家验证失败: ${error.message}`, 'E1100')
      }
    }
  }

  /**
   * 游戏状态验证
   * @param {Object} game - 游戏对象
   * @param {Array<Function>} allowedStates - 允许的状态类数组
   * @returns {{isValid: boolean, error?: GameError}} 验证结果
   */
  static validateGameState (game, allowedStates = []) {
    try {
      // 验证游戏对象
      if (!game) {
        return {
          isValid: false,
          error: new GameError('游戏对象为空', 'E1201')
        }
      }

      // 验证状态机
      if (!game.stateMachine || typeof game.stateMachine.getCurrentState !== 'function') {
        return {
          isValid: false,
          error: new GameError('游戏状态机无效', 'E1203')
        }
      }

      const currentState = game.stateMachine.getCurrentState()
      if (!currentState) {
        return {
          isValid: false,
          error: new GameError('游戏尚未开始或已结束', 'E1201')
        }
      }

      // 检查允许的状态
      if (allowedStates.length > 0) {
        const isStateAllowed = allowedStates.some(StateClass =>
          currentState instanceof StateClass
        )

        if (!isStateAllowed) {
          return {
            isValid: false,
            error: new GameError('当前阶段不能执行此操作', 'E1200')
          }
        }
      }

      return { isValid: true }
    } catch (error) {
      return {
        isValid: false,
        error: new GameError(`游戏状态验证失败: ${error.message}`, 'E1203')
      }
    }
  }

  /**
   * 目标有效性验证
   * @param {Object} target - 目标对象
   * @param {TargetValidator} validator - 自定义验证器函数
   * @param {Object} context - 验证上下文
   * @returns {{isValid: boolean, error?: GameError}} 验证结果
   */
  static validateTarget (target, validator = null, context = {}) {
    try {
      // 基础目标验证
      const basicValidation = this.validatePlayer(target, { checkAlive: true })
      if (!basicValidation.isValid) {
        return basicValidation
      }

      // 自定义验证器
      if (validator && typeof validator === 'function') {
        try {
          const customResult = validator(target, context)
          if (!customResult) {
            return {
              isValid: false,
              error: new GameError('目标验证失败', 'E1301')
            }
          }
        } catch (validatorError) {
          return {
            isValid: false,
            error: new GameError(`目标验证器执行失败: ${validatorError.message}`, 'E1301')
          }
        }
      }

      return { isValid: true }
    } catch (error) {
      return {
        isValid: false,
        error: new GameError(`目标验证失败: ${error.message}`, 'E1301')
      }
    }
  }

  /**
   * 行动有效性验证
   * @param {Object} player - 执行行动的玩家
   * @param {string} action - 行动类型
   * @param {Object} context - 验证上下文
   * @returns {{isValid: boolean, error?: GameError}} 验证结果
   */
  static validateAction (player, action, context = {}) {
    const {
      game = null,
      allowedStates = [],
      requiredRole = null,
      checkAlive = true
    } = context

    try {
      // 验证玩家
      const playerValidation = this.validatePlayer(player, {
        checkAlive,
        checkRole: !!requiredRole,
        requiredRole
      })

      if (!playerValidation.isValid) {
        return playerValidation
      }

      // 验证行动参数
      if (!action || typeof action !== 'string') {
        return {
          isValid: false,
          error: new GameError('行动参数无效', 'E1200')
        }
      }

      // 验证游戏状态
      if (game) {
        const stateValidation = this.validateGameState(game, allowedStates)
        if (!stateValidation.isValid) {
          return stateValidation
        }

        // 检查当前状态是否允许该行动
        const currentState = game.stateMachine.getCurrentState()
        if (currentState && typeof currentState.isValidAction === 'function') {
          if (!currentState.isValidAction(player, action)) {
            return {
              isValid: false,
              error: new GameError('当前状态不允许此行动', 'E1200')
            }
          }
        }
      }

      return { isValid: true }
    } catch (error) {
      return {
        isValid: false,
        error: new GameError(`行动验证失败: ${error.message}`, 'E1200')
      }
    }
  }

  /**
   * 验证游戏实例和玩家关系
   * @param {Object} game - 游戏对象
   * @param {string} playerId - 玩家ID
   * @returns {{isValid: boolean, player?: Object, error?: GameError}} 验证结果
   */
  static validateGamePlayer (game, playerId) {
    try {
      // 验证游戏对象
      if (!game) {
        return {
          isValid: false,
          error: new GameError('游戏对象为空', 'E1201')
        }
      }

      if (!game.players || typeof game.players.get !== 'function') {
        return {
          isValid: false,
          error: new GameError('游戏玩家数据无效', 'E1203')
        }
      }

      // 验证玩家ID
      if (!playerId) {
        return {
          isValid: false,
          error: new GameError('玩家ID为空', 'E1101')
        }
      }

      // 获取玩家对象
      const player = game.players.get(playerId)
      if (!player) {
        return {
          isValid: false,
          error: new GameError('玩家不存在', 'E1101')
        }
      }

      return {
        isValid: true,
        player
      }
    } catch (error) {
      return {
        isValid: false,
        error: new GameError(`游戏玩家验证失败: ${error.message}`, 'E1203')
      }
    }
  }

  /**
   * 验证角色实例
   * @param {Object} game - 游戏对象
   * @param {string} playerId - 玩家ID
   * @param {string} expectedRole - 期望的角色名称（可选）
   * @returns {{isValid: boolean, role?: Object, error?: GameError}} 验证结果
   */
  static validateRole (game, playerId, expectedRole = null) {
    try {
      // 先验证游戏和玩家
      const gamePlayerValidation = this.validateGamePlayer(game, playerId)
      if (!gamePlayerValidation.isValid) {
        return gamePlayerValidation
      }

      // 验证角色数据
      if (!game.roles || typeof game.roles.get !== 'function') {
        return {
          isValid: false,
          error: new GameError('游戏角色数据无效', 'E1203')
        }
      }

      const role = game.roles.get(playerId)
      if (!role) {
        return {
          isValid: false,
          error: new GameError('角色不存在', 'E1101')
        }
      }

      // 检查期望的角色
      if (expectedRole && role.constructor.name !== expectedRole) {
        return {
          isValid: false,
          error: new GameError(`角色不匹配，期望: ${expectedRole}`, 'E1402')
        }
      }

      return {
        isValid: true,
        role,
        player: gamePlayerValidation.player
      }
    } catch (error) {
      return {
        isValid: false,
        error: new GameError(`角色验证失败: ${error.message}`, 'E1203')
      }
    }
  }

  /**
   * 验证游戏号码
   * @param {number} number - 要验证的号码
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @returns {{isValid: boolean, error?: GameError}} 验证结果
   */
  static validateGameNumber (number, min = 1, max = 12) {
    try {
      // 检查是否为数字
      if (typeof number !== 'number' || isNaN(number)) {
        return {
          isValid: false,
          error: new GameError('号码必须是数字', 'E1101')
        }
      }

      // 检查范围
      if (number < min || number > max) {
        return {
          isValid: false,
          error: new GameError(`号码必须在 ${min}-${max} 范围内`, 'E1101')
        }
      }

      return { isValid: true }
    } catch (error) {
      return {
        isValid: false,
        error: new GameError(`号码验证失败: ${error.message}`, 'E1101')
      }
    }
  }

  /**
   * 验证投票目标
   * @param {Object} voter - 投票者
   * @param {Object} target - 投票目标
   * @param {Object} options - 验证选项
   * @returns {{isValid: boolean, error?: GameError}} 验证结果
   */
  static validateVoteTarget (voter, target, options = {}) {
    const { allowSelfVote = true } = options

    try {
      // 验证投票者
      const voterValidation = this.validatePlayer(voter, { checkAlive: true })
      if (!voterValidation.isValid) {
        return voterValidation
      }

      // 验证目标
      const targetValidation = this.validatePlayer(target, { checkAlive: true })
      if (!targetValidation.isValid) {
        return {
          isValid: false,
          error: new GameError('投票目标无效或已死亡', 'E1300')
        }
      }

      // 检查自投票限制
      if (!allowSelfVote && voter.id === target.id) {
        return {
          isValid: false,
          error: new GameError('不能投票给自己', 'E1300')
        }
      }

      return { isValid: true }
    } catch (error) {
      return {
        isValid: false,
        error: new GameError(`投票目标验证失败: ${error.message}`, 'E1300')
      }
    }
  }

  /**
   * 批量验证
   * @param {Array<Function>} validators - 验证器函数数组
   * @returns {{isValid: boolean, errors: Array<GameError>}} 验证结果
   */
  static validateBatch (validators) {
    const errors = []

    try {
      for (const validator of validators) {
        if (typeof validator === 'function') {
          const result = validator()
          if (result && !result.isValid && result.error) {
            errors.push(result.error)
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      }
    } catch (error) {
      errors.push(new GameError(`批量验证失败: ${error.message}`, 'E1000'))
      return {
        isValid: false,
        errors
      }
    }
  }
}

export const ValidationUtils = Validator
