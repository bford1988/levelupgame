// Message types shared between server and client
const MSG = {
  // Client -> Server
  JOIN: 1,
  INPUT: 2,
  RESPAWN: 3,
  VIEWPORT: 4,

  // Server -> Client
  WELCOME: 10,
  STATE: 11,
  DEATH: 12,
  KILL_FEED: 13,
  PLAYER_JOIN: 14,
  PLAYER_LEAVE: 15,
};

if (typeof module !== 'undefined') module.exports = { MSG };
