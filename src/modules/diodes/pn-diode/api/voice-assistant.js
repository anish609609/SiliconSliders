/**
 * src/modules/diodes/pn-diode/api/voice-assistant.js
 * Vercel Serverless Function & Node backend handler for PN Junction Diode Sarvam AI Voice Tutor.
 */

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';

function getFallbackExplanation(question, context, lang) {
  const comp = context && context.title ? context.title : 'PN Junction Diode';
  const role = context && context.role ? context.role : 'rectifying electrical conduction across a metallurgical P-N junction.';
  const mode = context && context.circuitState && context.circuitState.mode ? context.circuitState.mode : 'Equilibrium';
  const va = context && context.circuitState && context.circuitState.va ? context.circuitState.va : '0.00 V';
  const current = context && context.circuitState && context.circuitState.current ? context.circuitState.current : '0.00 mA';
  const vbr = context && context.circuitState && context.circuitState.vbr ? context.circuitState.vbr : '12.0 V';

  const qLower = (question || '').toLowerCase();

  if (qLower.includes('breakdown') || qLower.includes('zener') || qLower.includes('avalanche')) {
    return `In this PN diode, reverse breakdown occurs when the applied bias reaches negative ${vbr}. If breakdown is below 5 volts, high electric field causes quantum mechanical band-to-band tunneling known as Zener breakdown. Above 6 volts, accelerated carriers strike silicon lattice atoms causing impact ionization and avalanche multiplication.`;
  }
  if (qLower.includes('depletion') || qLower.includes('width') || qLower.includes('space charge')) {
    return `The space-charge depletion region forms at the metallurgical junction as mobile electrons and holes diffuse across, uncovering uncompensated ionized donor cations on the N-side and acceptor anions on the P-side. Under forward bias it contracts, while under reverse bias it widens to support the increased barrier potential.`;
  }
  if (qLower.includes('forward') || qLower.includes('shockley') || qLower.includes('current')) {
    return `Under forward bias (currently ${va}), the external potential lowers the built-in barrier, allowing exponential diffusion of majority carriers across the junction. Total current follows the Shockley diode equation, rising steeply once the cut-in voltage around 0.6 to 0.7 volts is exceeded.`;
  }

  return `In this 3D PN Junction Diode, the device is currently in ${mode} at an applied voltage of ${va} with ${current} current. The ${comp} facilitates this by ${role}`;
}

module.exports = async function handler(req, res) {
  try {
    let body = {};
    if (req.method === 'POST') {
      if (typeof req.body === 'object' && req.body !== null) {
        body = req.body;
      } else {
        const buffers = [];
        for await (const chunk of req) buffers.push(chunk);
        const raw = Buffer.concat(buffers).toString();
        try { body = JSON.parse(raw); } catch (_) { body = {}; }
      }
    }

    const question = body.question || body.text || 'Explain PN Diode operation.';
    const context = body.context || {};
    const langCode = body.target_language_code || body.lang || 'en-IN';
    const clientKey = (req.headers['api-subscription-key'] || body.apiKey || SARVAM_API_KEY || '').trim();

    if (!clientKey) {
      const fallback = getFallbackExplanation(question, context, langCode);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ text: fallback, audio: null }));
    }

    // Call Sarvam completions
    const chatRes = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': clientKey
      },
      body: JSON.stringify({
        model: 'sarvam-105b-conversations',
        messages: [
          {
            role: 'system',
            content: 'You are an expert semiconductor physicist explaining a 3D PN Junction Diode CAD model. Answer in 2-3 concise spoken sentences (~45-60 words) without bullet points, asterisks, or markdown equations.'
          },
          {
            role: 'user',
            content: `Context: ${JSON.stringify(context)}\nQuestion: ${question}`
          }
        ],
        temperature: 0.3,
        max_tokens: 150
      })
    });

    if (!chatRes.ok) {
      throw new Error('Sarvam LLM returned status ' + chatRes.status);
    }

    const chatData = await chatRes.json();
    const explanation = chatData.choices[0].message.content;

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ text: explanation }));
  } catch (err) {
    console.error('PN Diode Voice API Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message, fallback: getFallbackExplanation('', {}, 'en-IN') }));
  }
};
