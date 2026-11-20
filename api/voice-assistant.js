/**
 * SiliconSliders — Unified Vercel Serverless Function & API Handler
 * Routes Sarvam AI Voice Assistant API requests (/api/voice-assistant & /api/explain)
 */

let inverterVoiceHandler = null;
let nandVoiceHandler = null;

function getInverterVoiceHandler() {
  if (!inverterVoiceHandler) {
    try {
      inverterVoiceHandler = require('../src/modules/transistors/cmos-inverter/api/voice-assistant.js');
    } catch (e) {
      console.warn('Could not load inverter voice handler:', e.message);
    }
  }
  return inverterVoiceHandler;
}

function getNandVoiceHandler() {
  if (!nandVoiceHandler) {
    try {
      nandVoiceHandler = require('../src/modules/transistors/cmos-nand/api/voice-assistant.js');
    } catch (e) {
      console.warn('Could not load nand voice handler:', e.message);
    }
  }
  return nandVoiceHandler;
}

module.exports = async function handler(req, res) {
  try {
    const referer = req.headers.referer || '';
    if (referer.toLowerCase().includes('nand')) {
      const h = getNandVoiceHandler();
      if (h) return await h(req, res);
    } else {
      const h = getInverterVoiceHandler();
      if (h) return await h(req, res);
    }
    
    // Fallback if specific handler not resolved
    if (!res.headersSent) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Voice assistant handler not found' }));
    }
  } catch (err) {
    console.error('API Error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    }
  }
};
