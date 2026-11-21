/**
 * src/modules/transistors/mosfet/nmos/api/voice-assistant.js
 * Vercel Serverless Function & Node backend handler for NMOS Transistor Sarvam AI Voice Tutor.
 */

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';

function getFallbackExplanation(question, context, lang) {
  const comp = context && context.title ? context.title : 'NMOS Transistor';
  const role = context && context.role ? context.role : 'controlling channel electron conduction via gate field.';
  return `In this 3D NMOS transistor, every layer solves a fundamental semiconductor physics challenge. The ${comp} fulfills this by ${role}`;
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

    const question = body.question || body.text || 'Explain NMOS operation.';
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
            content: 'You are an expert VLSI educator explaining a 3D discrete NMOS transistor CAD model. Answer in 2-3 concise spoken sentences (~45-60 words) without bullet points, asterisks, or markdown equations.'
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
    console.error('NMOS Voice API Error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message, fallback: getFallbackExplanation('', {}, 'en-IN') }));
  }
};
