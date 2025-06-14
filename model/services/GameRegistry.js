export class GameRegistry {
    // 静态游戏实例存储
    static games = new Map();

    // 获取游戏实例
    static getGame(groupId) {
        return this.games.get(groupId);
    }

    // 添加游戏实例
    static addGame(groupId, gameInstance) {
        this.games.set(groupId, gameInstance);
    }

    // 移除游戏实例
    static removeGame(groupId) {
        this.games.delete(groupId);
    }

    // 检查游戏是否存在
    static hasGame(groupId) {
        return this.games.has(groupId);
    }
} 