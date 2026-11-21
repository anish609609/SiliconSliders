/**
 * Silicon Sliders - Unified Platform Development Server
 * Serves the Front Homepage, Modular Transistors, Process Engineering, and MEMS modules
 * Routes Sarvam AI Voice Assistant API requests
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT, 10) || 3000;

// Load environment variables from .env if present
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn('Notice: Failed reading .env:', err.message);
  }
}
loadEnv();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.md': 'text/markdown; charset=utf-8'
};

// Lazy loaded voice handlers
let inverterVoiceHandler = null;
let nandVoiceHandler = null;
let nmosVoiceHandler = null;
let pmosVoiceHandler = null;

function getInverterVoiceHandler() {
  if (!inverterVoiceHandler) {
    const p = path.join(ROOT, 'src', 'modules', 'transistors', 'cmos', 'cmos-inverter', 'api', 'voice-assistant.js');
    if (fs.existsSync(p)) inverterVoiceHandler = require(p);
    else {
      const fallbackP = path.join(ROOT, 'src', 'modules', 'transistors', 'cmos-inverter', 'api', 'voice-assistant.js');
      if (fs.existsSync(fallbackP)) inverterVoiceHandler = require(fallbackP);
      else {
        const legacyP = path.join(ROOT, 'cmos_inverter_CAD', 'api', 'voice-assistant.js');
        if (fs.existsSync(legacyP)) inverterVoiceHandler = require(legacyP);
      }
    }
  }
  return inverterVoiceHandler;
}

function getNandVoiceHandler() {
  if (!nandVoiceHandler) {
    const p = path.join(ROOT, 'src', 'modules', 'transistors', 'cmos', 'cmos-nand', 'api', 'voice-assistant.js');
    if (fs.existsSync(p)) nandVoiceHandler = require(p);
    else {
      const fallbackP = path.join(ROOT, 'src', 'modules', 'transistors', 'cmos-nand', 'api', 'voice-assistant.js');
      if (fs.existsSync(fallbackP)) nandVoiceHandler = require(fallbackP);
      else {
        const legacyP = path.join(ROOT, 'CMOS_NAND', 'api', 'voice-assistant.js');
        if (fs.existsSync(legacyP)) nandVoiceHandler = require(legacyP);
      }
    }
  }
  return nandVoiceHandler;
}

function getNmosVoiceHandler() {
  if (!nmosVoiceHandler) {
    const p = path.join(ROOT, 'src', 'modules', 'transistors', 'mosfet', 'nmos', 'api', 'voice-assistant.js');
    if (fs.existsSync(p)) nmosVoiceHandler = require(p);
  }
  return nmosVoiceHandler;
}

function getPmosVoiceHandler() {
  if (!pmosVoiceHandler) {
    const p = path.join(ROOT, 'src', 'modules', 'transistors', 'mosfet', 'pmos', 'api', 'voice-assistant.js');
    if (fs.existsSync(p)) pmosVoiceHandler = require(p);
  }
  return pmosVoiceHandler;
}

function enhanceResponse(res) {
  if (!res.status) {
    res.status = function (code) {
      res.statusCode = code;
      return res;
    };
  }
  if (!res.json) {
    res.json = function (payload) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(JSON.stringify(payload));
      return res;
    };
  }
  return res;
}

const server = http.createServer(async (req, res) => {
  enhanceResponse(res);
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsed.pathname || '/');

  // API Routing for Sarvam AI Voice Assistant
  if (pathname === '/api/voice-assistant' || pathname === '/api/explain') {
    try {
      // Check referer to determine which module is requesting
      const referer = (req.headers.referer || '').toLowerCase();
      if (referer.includes('nand')) {
        const h = getNandVoiceHandler();
        if (h) return await h(req, res);
      } else if (referer.includes('nmos')) {
        const h = getNmosVoiceHandler();
        if (h) return await h(req, res);
      } else if (referer.includes('pmos')) {
        const h = getPmosVoiceHandler();
        if (h) return await h(req, res);
      } else {
        const h = getInverterVoiceHandler();
        if (h) return await h(req, res);
      }
    } catch (apiErr) {
      console.error('API Error:', apiErr);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: apiErr.message }));
      }
      return;
    }
  }

  // Friendly aliases - Redirect to directory context so relative asset paths resolve correctly
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  } else if (pathname === '/inverter' || pathname === '/inverter/') {
    res.writeHead(302, { Location: '/src/modules/transistors/cmos/cmos-inverter/index.html' });
    return res.end();
  } else if (pathname === '/nand' || pathname === '/nand/') {
    res.writeHead(302, { Location: '/src/modules/transistors/cmos/cmos-nand/index.html' });
    return res.end();
  } else if (pathname === '/nmos' || pathname === '/nmos/') {
    res.writeHead(302, { Location: '/src/modules/transistors/mosfet/nmos/index.html' });
    return res.end();
  } else if (pathname === '/pmos' || pathname === '/pmos/') {
    res.writeHead(302, { Location: '/src/modules/transistors/mosfet/pmos/index.html' });
    return res.end();
  } else if (pathname === '/oxidation' || pathname === '/oxidation/') {
    res.writeHead(302, { Location: '/src/modules/processes/oxidation/index.html' });
    return res.end();
  } else if (pathname === '/cmos_inverter_CAD' || pathname === '/cmos_inverter_CAD/') {
    res.writeHead(302, { Location: '/src/modules/transistors/cmos/cmos-inverter/index.html' });
    return res.end();
  } else if (pathname === '/CMOS_NAND' || pathname === '/CMOS_NAND/') {
    res.writeHead(302, { Location: '/src/modules/transistors/cmos/cmos-nand/index.html' });
    return res.end();
  }

  // Sanitize path to prevent directory traversal
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let fullPath = path.join(ROOT, safePath);

  // If path is a directory, look for index.html inside
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    fullPath = path.join(fullPath, 'index.html');
  }

  // Security check: must reside inside ROOT
  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end(`404 Not Found: ${pathname}`);
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('\n======================================================');
  console.log('  🚀 SILICON SLIDERS — 3D Semiconductor CAD Platform');
  console.log(`  Local URL:        http://localhost:${PORT}`);
  console.log(`  CMOS Inverter:    http://localhost:${PORT}/inverter`);
  console.log(`  CMOS NAND2:       http://localhost:${PORT}/nand`);
  console.log(`  Thermal Oxidation http://localhost:${PORT}/oxidation`);
  console.log('======================================================\n');
});
