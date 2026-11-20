/**
 * SiliconSliders — Unified Vercel Serverless Function & API Handler (/api/explain)
 */

const voiceAssistantHandler = require('./voice-assistant.js');

module.exports = async function handler(req, res) {
  return await voiceAssistantHandler(req, res);
};
