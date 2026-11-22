/**
 * SiliconSliders — Unified Vercel Serverless Function & API Handler
 * Routes Sarvam AI Voice Assistant API requests (/api/voice-assistant & /api/explain)
 */

let inverterVoiceHandler = null;
let nandVoiceHandler = null;
let nmosVoiceHandler = null;
let pmosVoiceHandler = null;
let diodeVoiceHandler = null;

function getDiodeVoiceHandler() {
  if (!diodeVoiceHandler) {
    try {
      diodeVoiceHandler = require('../src/modules/diodes/pn-diode/api/voice-assistant.js');
    } catch (err) {
      console.warn('Could not load diode voice handler:', err.message);
    }
  }
  return diodeVoiceHandler;
}

function getInverterVoiceHandler() {
  if (!inverterVoiceHandler) {
    try {
      inverterVoiceHandler = require('../src/modules/transistors/cmos/cmos-inverter/api/voice-assistant.js');
    } catch (e) {
      try {
        inverterVoiceHandler = require('../src/modules/transistors/cmos-inverter/api/voice-assistant.js');
      } catch (err) {
        console.warn('Could not load inverter voice handler:', err.message);
      }
    }
  }
  return inverterVoiceHandler;
}

function getNandVoiceHandler() {
  if (!nandVoiceHandler) {
    try {
      nandVoiceHandler = require('../src/modules/transistors/cmos/cmos-nand/api/voice-assistant.js');
    } catch (e) {
      try {
        nandVoiceHandler = require('../src/modules/transistors/cmos-nand/api/voice-assistant.js');
      } catch (err) {
        console.warn('Could not load nand voice handler:', err.message);
      }
    }
  }
  return nandVoiceHandler;
}

function getNmosVoiceHandler() {
  if (!nmosVoiceHandler) {
    try {
      nmosVoiceHandler = require('../src/modules/transistors/mosfet/nmos/api/voice-assistant.js');
    } catch (err) {
      console.warn('Could not load nmos voice handler:', err.message);
    }
  }
  return nmosVoiceHandler;
}

function getPmosVoiceHandler() {
  if (!pmosVoiceHandler) {
    try {
      pmosVoiceHandler = require('../src/modules/transistors/mosfet/pmos/api/voice-assistant.js');
    } catch (err) {
      console.warn('Could not load pmos voice handler:', err.message);
    }
  }
  return pmosVoiceHandler;
}

module.exports = async function handler(req, res) {
  try {
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
    } else if (referer.includes('diode')) {
      const h = getDiodeVoiceHandler();
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
