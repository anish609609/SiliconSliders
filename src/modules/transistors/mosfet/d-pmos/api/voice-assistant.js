/**
 * src/modules/transistors/mosfet/d-pmos/api/voice-assistant.js
 * Vercel Serverless Function & Node backend handler for Depletion PMOS (D-PMOS) Transistor Sarvam AI Voice Tutor.
 */

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';

function getFallbackExplanation(question, context, lang) {
  const comp = context && context.title ? context.title : 'Depletion PMOS Transistor';
  const role = context && context.role ? context.role : 'normally-ON mobile hole conduction through an implanted P-channel inside the N-well.';
  return `In this 3D Depletion PMOS transistor, a shallow P-type channel is permanently implanted inside the N-well, providing mobile hole conduction at zero gate bias (VGS = 0V) with a positive threshold voltage VTH,p = +0.80V. The ${comp} fulfills this by ${role}`;
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

    const question = body.question || body.text || 'Explain PMOS operation.';
    const context = body.context || {};
    const langCode = body.target_language_code || body.lang || 'en-IN';
    const clientKey = (req.headers['api-subscription-key'] || body.apiKey || SARVAM_API_KEY || '').trim();

    if (!clientKey) {
      const fallback = getFallbackExplanation(question, context, langCode);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ text: fallback, audio: null }));
    }

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
            content: 'You are an expert VLSI educator explaining a 3D discrete Depletion-Mode PMOS (D-PMOS) transistor CAD model with an implanted P-channel and Normally ON hole physics. Answer in 2-3 concise spoken sentences (~45-60 words) without bullet points, asterisks, or markdown equations.'
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
    console.error('PMOS Voice API Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message, fallback: getFallbackExplanation('', {}, 'en-IN') }));
  }
};
