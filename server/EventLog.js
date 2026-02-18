class EventLog {
  constructor(maxEntries = 500) {
    this.entries = [];
    this.maxEntries = maxEntries;
  }

  log(type, message) {
    this.entries.push({
      time: Date.now(),
      type,
      message,
    });
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  getRecent(count = 100) {
    return this.entries.slice(-count).reverse();
  }
}

module.exports = EventLog;
