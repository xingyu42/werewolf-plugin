/**
 * 游戏错误类 - 用于统一处理游戏中的错误
 * 提供错误码和详细信息，便于调试和日志记录
 */
export class GameError extends Error {
  /**
   * 创建游戏错误
   * @param {string} message 错误消息
   * @param {string} code 错误代码
   * @param {Object} details 错误详情
   */
  constructor(message, code = 'UNKNOWN_ERROR', details = {}) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }
  
  /**
   * 获取格式化的错误信息
   * @returns {string} 格式化的错误信息
   */
  getFormattedMessage() {
    return `[${this.code}] ${this.message}`;
  }
  
  /**
   * 获取错误的完整信息（用于日志）
   * @returns {Object} 完整的错误信息对象
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp.toISOString()
    };
  }
} 