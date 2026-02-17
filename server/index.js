const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const config = require('./config');
const Game = require('./Game');
const { MSG } = require('../shared/constants');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const ROOT = path.join(__dirname, '..');

function serveStatic(req, res) {
  let filePath;

  if (req.url === '/') {
    filePath = path.join(ROOT, 'public', 'index.html');
  } else if (req.url.startsWith('/shared/')) {
    filePath = path.join(ROOT, req.url);
  } else {
    filePath = path.join(ROOT, 'public', req.url);
  }

  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ server });
const game = new Game();

wss.on('connection', (ws) => {
  let player = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    switch (msg.t) {
      case MSG.JOIN:
        player = game.addPlayer(ws, msg.name || 'Player', msg.color || '#00e5ff');
        console.log(`${player.name} joined (${player.id})`);
        break;
      case MSG.INPUT:
        if (player) game.handleInput(player.id, msg);
        break;
      case MSG.RESPAWN:
        if (player) game.handleRespawn(player.id);
        break;
      case MSG.VIEWPORT:
        if (player) {
          player.viewportW = msg.w || 1920;
          player.viewportH = msg.h || 1080;
        }
        break;
    }
  });

  ws.on('close', () => {
    if (player) {
      console.log(`${player.name} left (${player.id})`);
      game.removePlayer(player.id);
    }
  });
});

game.start();

server.listen(config.PORT, () => {
  console.log(`Server running at http://localhost:${config.PORT}`);
});
