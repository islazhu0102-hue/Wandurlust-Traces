const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const DB_FILE = path.join(__dirname, 'db.json');

// 初始化数据库文件
const initDb = () => {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = [
      {
        id: '1',
        latitude: 51.4778,
        longitude: -0.0015,
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        dateDisplay: new Date(Date.now() - 86400000 * 2).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
        note: "Walking through Greenwich Park. The view of the city from the top of the hill is breathtaking.",
        category: 'Nature',
        photoUrl: "https://picsum.photos/200/200?random=1"
      }
    ];
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
};

let entries = initDb();

const saveDb = () => {
  fs.writeFileSync(DB_FILE, JSON.stringify(entries, null, 2));
};

const getBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 50 * 1024 * 1024) reject('Payload too large');
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
    });
  });
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const parsedUrl = url.parse(req.url, true);
  const pathName = parsedUrl.pathname;

  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathName}`);

  try {
    if (pathName === '/ping' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'online', storage: 'filesystem' }));
    }
    else if (pathName === '/entries' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(entries));
    }
    else if (pathName === '/entries' && req.method === 'POST') {
      const data = await getBody(req);
      const newEntry = {
        id: Date.now().toString(),
        ...data,
        timestamp: data.timestamp || new Date().toISOString()
      };
      entries.push(newEntry);
      saveDb();
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newEntry));
    }
    else if (pathName.startsWith('/entries/') && req.method === 'DELETE') {
      const id = pathName.split('/').pop();
      entries = entries.filter(e => e.id !== id);
      saveDb();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    }
    else {
      res.writeHead(404); res.end();
    }
  } catch (err) {
    console.error('Server Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

server.listen(PORT, () => {
  console.log(`\n🌟 Luminary Pro Backend Active!`);
  console.log(`💾 Persistence: Data is being saved to ${DB_FILE}`);
  console.log(`🔗 Local URL: http://localhost:${PORT}\n`);
});