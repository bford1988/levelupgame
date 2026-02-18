const crypto = require('crypto');
const config = require('./config');
const Game = require('./Game');
const EventLog = require('./EventLog');

class InstanceManager {
  constructor() {
    this.instances = [];
    this.eventLog = new EventLog();
    this.startTime = Date.now();
    this.playerCountHistory = []; // {time, count} for sparkline
    this.createInstance(); // always start with one instance

    // Record player count every 10 seconds for sparkline
    setInterval(() => {
      let total = 0;
      for (const inst of this.instances) {
        total += inst.getRealPlayerCount();
      }
      this.playerCountHistory.push({ time: Date.now(), count: total });
      // Keep last 5 minutes (30 entries at 10s interval)
      if (this.playerCountHistory.length > 30) {
        this.playerCountHistory.shift();
      }
    }, 10000);
  }

  createInstance() {
    const instance = new Game();
    instance.instanceId = crypto.randomBytes(4).toString('hex');
    instance.start();
    this.instances.push(instance);
    this.eventLog.log('instance_create', `Instance ${instance.instanceId} created`);
    console.log(`Created game instance ${instance.instanceId} (total: ${this.instances.length})`);
    return instance;
  }

  findAvailableInstance() {
    for (const instance of this.instances) {
      if (instance.getRealPlayerCount() < config.MAX_PLAYERS) {
        return instance;
      }
    }
    return this.createInstance();
  }

  addPlayer(ws, name, color, catchphrase) {
    const instance = this.findAvailableInstance();
    const player = instance.addPlayer(ws, name, color, catchphrase);
    if (player) {
      player._instance = instance;
      this.eventLog.log('player_join', `${name} joined instance ${instance.instanceId}`);
    }
    return player;
  }

  removePlayer(player) {
    if (!player || !player._instance) return;
    const instance = player._instance;
    this.eventLog.log('player_leave', `${player.name} left instance ${instance.instanceId}`);
    instance.removePlayer(player.id);
    this.cleanupInstances();
  }

  cleanupInstances() {
    if (this.instances.length <= 1) return;

    for (let i = this.instances.length - 1; i >= 0; i--) {
      const instance = this.instances[i];
      if (instance.getRealPlayerCount() === 0 && this.instances.length > 1) {
        instance.stop();
        this.eventLog.log('instance_destroy', `Instance ${instance.instanceId} destroyed`);
        this.instances.splice(i, 1);
        console.log(`Cleaned up empty instance ${instance.instanceId} (remaining: ${this.instances.length})`);
      }
    }
  }

  findInstance(instanceId) {
    return this.instances.find(i => i.instanceId === instanceId);
  }

  getStats() {
    let totalRealPlayers = 0;
    let totalBots = 0;
    const instances = [];

    for (const inst of this.instances) {
      const realCount = inst.getRealPlayerCount();
      const botCount = inst.bots.length;
      totalRealPlayers += realCount;
      totalBots += botCount;

      const allPlayers = [];
      for (const [id, p] of inst.players) {
        allPlayers.push({
          id,
          name: p.name,
          score: p.score,
          kills: p.kills,
          tier: p.tier,
          isBot: !!p.isBot,
          alive: p.alive,
          x: Math.round(p.x),
          y: Math.round(p.y),
          color: p.color,
        });
      }
      allPlayers.sort((a, b) => b.score - a.score);

      instances.push({
        id: inst.instanceId,
        realPlayers: realCount,
        bots: botCount,
        totalEntities: inst.players.size,
        tick: inst.tick,
        foodCount: inst.food.length,
        mineCount: inst.mines.length,
        projectileCount: inst.projectiles.length,
        topPlayers: allPlayers.slice(0, 10),
        allPlayers,
      });
    }

    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      totalRealPlayers,
      totalBots,
      totalInstances: this.instances.length,
      playerCountHistory: this.playerCountHistory,
      instances,
    };
  }
}

module.exports = InstanceManager;
