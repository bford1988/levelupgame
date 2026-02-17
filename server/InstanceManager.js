const crypto = require('crypto');
const config = require('./config');
const Game = require('./Game');

class InstanceManager {
  constructor() {
    this.instances = [];
    this.createInstance(); // always start with one instance
  }

  createInstance() {
    const instance = new Game();
    instance.instanceId = crypto.randomBytes(4).toString('hex');
    instance.start();
    this.instances.push(instance);
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
    }
    return player;
  }

  removePlayer(player) {
    if (!player || !player._instance) return;
    const instance = player._instance;
    instance.removePlayer(player.id);
    this.cleanupInstances();
  }

  cleanupInstances() {
    if (this.instances.length <= 1) return;

    for (let i = this.instances.length - 1; i >= 0; i--) {
      const instance = this.instances[i];
      if (instance.getRealPlayerCount() === 0 && this.instances.length > 1) {
        instance.stop();
        this.instances.splice(i, 1);
        console.log(`Cleaned up empty instance ${instance.instanceId} (remaining: ${this.instances.length})`);
      }
    }
  }
}

module.exports = InstanceManager;
