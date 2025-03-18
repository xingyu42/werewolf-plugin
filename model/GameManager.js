export class GameManager {
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

    constructor(gameConfig) {
        this.gameConfig = gameConfig;
        this.players = [];
    }

    // 检查玩家是否已加入
    hasPlayer(playerId) {
        return this.players.some((p) => p.id === playerId);
    }

    // 添加玩家
    addPlayer(playerInfo) {
        const playerCount = this.players.length;
        const maxPlayers = this.gameConfig.game.maxPlayers // 从game配置中获取maxPlayers

        if (playerCount >= maxPlayers) {
            throw new Error(`游戏人数已达上限${maxPlayers}人`);
        }

        if (this.hasPlayer(playerInfo.id)) {
            throw new Error('该玩家已经在游戏中');
        }

        this.players.push(playerInfo);
        return this;
    }

    // 移除玩家
    removePlayer(playerId) {
        const index = this.players.findIndex((p) => p.id === playerId);
        if (index !== -1) {
            this.players.splice(index, 1);
        }
        return this;
    }

    // 设置玩家列表
    setPlayers(players) {
        const playerCount = players.length;
        const minPlayers = this.gameConfig.game.minPlayers
        const maxPlayers = this.gameConfig.game.maxPlayers

        if (playerCount < minPlayers || playerCount > maxPlayers) {
            throw new Error(`玩家数量必须在${minPlayers}到${maxPlayers}之间`);
        }
        this.players = players;
        return this;
    }

    // 获取玩家列表
    getPlayers() {
        return this.players;
    }

    // 获取当前玩家数量对应的角色列表
    getRoleList() {
        const playerCount = this.players.length;
        const roles = this.gameConfig.roles.roleConfigs[playerCount];

        if (!roles) {
            throw new Error(`未配置${playerCount}人局的角色列表`);
        }
        return roles;
    }

}
