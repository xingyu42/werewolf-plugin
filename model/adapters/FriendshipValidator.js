/**
 * 好友验证器
 * 使用bot.fl.has()方法进行可靠的好友检测
 * 基于icqq好友列表缓存，比pickFriend更准确
 */

export class FriendshipValidator {

  /**
   * 检查单个玩家是否为好友
   * @param {Object} e - 事件对象
   * @param {string} playerId - 玩家ID
   * @returns {Promise<boolean>} 是否为好友
   */
  static async checkFriend(e, playerId) {
    try {
      // 检查bot对象和好友列表
      if (!e.bot) {
        console.warn(`[FriendshipValidator] Bot对象不可用`)
        return false
      }

      if (!e.bot.fl) {
        console.warn(`[FriendshipValidator] Bot好友列表(fl)不可用`)
        return false
      }

      // 使用bot.fl.has()方法检查好友列表
      const isFriend = e.bot.fl.has(parseInt(playerId))

      if (isFriend) {
        console.log(`[FriendshipValidator] 玩家 ${playerId} 在好友列表中`)
      } else {
        console.log(`[FriendshipValidator] 玩家 ${playerId} 不在好友列表中`)
      }

      return isFriend

    } catch (error) {
      console.error(`[FriendshipValidator] 检查玩家 ${playerId} 好友状态时发生错误:`, error)
      return false
    }
  }

  /**
   * 批量检查玩家好友状态
   * @param {Array} players - 玩家对象数组
   * @param {Object} e - 事件对象
   * @returns {Promise<Object>} 检查结果 {allFriends: boolean, nonFriends: Array}
   */
  static async validateBatch(players, e) {
    const nonFriends = []

    console.log(`[FriendshipValidator] 开始检查 ${players.length} 个玩家的好友状态`)

    for (const player of players) {
      const isFriend = await this.checkFriend(e, player.id)
      if (!isFriend) {
        nonFriends.push(player)
      }
    }

    console.log(`[FriendshipValidator] 好友检查完成，${nonFriends.length} 个非好友`)

    return {
      allFriends: nonFriends.length === 0,
      nonFriends
    }
  }


}