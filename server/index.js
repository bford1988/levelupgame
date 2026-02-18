const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const config = require('./config');
const InstanceManager = require('./InstanceManager');
const { filterText } = require('./profanity');
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

// Admin auth
const ADMIN_PASSWORD = 'qvhGVRFsFdxyDpci';
const ADMIN_SECRET = 'barrage_admin_' + crypto.randomBytes(8).toString('hex');

function makeAdminToken() {
  return crypto.createHmac('sha256', ADMIN_SECRET).update(ADMIN_PASSWORD).digest('hex').slice(0, 32);
}

function parseCookies(req) {
  return (req.headers.cookie || '').split(';').reduce((acc, c) => {
    const [k, v] = c.trim().split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {});
}

function parseUrl(req) {
  return new URL(req.url, `http://${req.headers.host || 'localhost'}`);
}

function checkAdminAuth(req) {
  const cookies = parseCookies(req);
  if (cookies.admin_token === makeAdminToken()) return true;

  const u = parseUrl(req);
  if (u.searchParams.get('pw') === ADMIN_PASSWORD) return true;

  return false;
}

function setAdminCookie(res) {
  res.setHeader('Set-Cookie', `admin_token=${makeAdminToken()}; Path=/; HttpOnly; SameSite=Strict`);
}

function handleAdminRequest(req, res, manager) {
  const u = parseUrl(req);
  const pathname = u.pathname;

  if (!checkAdminAuth(req)) {
    res.writeHead(401, { 'Content-Type': 'text/html' });
    res.end('<h1>401 Unauthorized</h1><p>Invalid or missing password.</p>');
    return true;
  }

  // Serve admin page
  if (pathname === '/adminford' || pathname === '/adminford/') {
    setAdminCookie(res);
    const adminPath = path.join(ROOT, 'public', 'admin.html');
    fs.readFile(adminPath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Admin page not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return true;
  }

  // API: stats
  if (pathname === '/adminford/api/stats') {
    const stats = manager.getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
    return true;
  }

  // API: event log
  if (pathname === '/adminford/api/log') {
    const count = parseInt(u.searchParams.get('count')) || 100;
    const entries = manager.eventLog.getRecent(count);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(entries));
    return true;
  }

  return false;
}

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

const manager = new InstanceManager();

const server = http.createServer((req, res) => {
  const u = parseUrl(req);

  // Admin routes
  if (u.pathname.startsWith('/adminford')) {
    if (handleAdminRequest(req, res, manager)) return;
  }

  serveStatic(req, res);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const u = parseUrl(req);

  // Spectator connection
  if (u.searchParams.get('spectate')) {
    const cookies = parseCookies(req);
    if (cookies.admin_token !== makeAdminToken()) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    const instanceId = u.searchParams.get('spectate');
    const instance = manager.findInstance(instanceId);
    if (!instance) {
      ws.close(4004, 'Instance not found');
      return;
    }

    instance.addSpectator(ws);
    ws.on('close', () => {
      instance.removeSpectator(ws);
    });
    return;
  }

  // Regular player connection
  let player = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    switch (msg.t) {
      case MSG.JOIN: {
        const name = filterText((msg.name || 'Player').slice(0, 16));
        const catchphrase = filterText(
          typeof msg.catchphrase === 'string' ? msg.catchphrase.slice(0, 40) : ''
        );
        player = manager.addPlayer(ws, name, msg.color || '#00e5ff', catchphrase);
        if (player) {
          console.log(`${player.name} joined instance ${player._instance.instanceId} (${player.id})`);
        }
        break;
      }
      case MSG.INPUT:
        if (player && player._instance) player._instance.handleInput(player.id, msg);
        break;
      case MSG.RESPAWN:
        if (player && player._instance) player._instance.handleRespawn(player.id);
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
      manager.removePlayer(player);
      player = null;
    }
  });
});

server.listen(config.PORT, () => {
  console.log(`Server running at http://localhost:${config.PORT}`);
});
