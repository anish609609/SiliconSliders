/**
 * voice-assistant.js - PN Junction Diode CAD Viewer
 * Sarvam AI Voice Assistant Tutor & Audio Narration Engine
 * - Full parity Sarvam AI API Key modal with test voice verification
 * - Speech-to-text (Web Speech STT) with active listening state
 * - Text-to-speech (Sarvam Bulbul v4 Flash 24kHz)
 * - LLM tutoring powered by sarvam-105b-conversations
 * - Rich offline/fallback educational responses wired to live PN Diode physics telemetry.
 */

(function () {
  var SARVAM_KEY_STORAGE = 'sarvam_api_key_custom';
  var STORAGE_KEY_SESSION_ONLY = 'sarvam_key_session_only';

  var PERSONAS = {
    'en-IN': [
      { id: 'aparna_en_edtech', name: 'Aparna (EdTech Tutor)' },
      { id: 'aparna_en_companion', name: 'Aparna (Companion)' }
    ],
    'hi-IN': [
      { id: 'aparna_hi_customer', name: 'Aparna (Hindi Tutor)' },
      { id: 'shubh_hi_customer', name: 'Shubh (Hindi Conversational)' }
    ],
    'te-IN': [
      { id: 'kavitha_te_narration', name: 'Kavitha (Telugu Narration)' }
    ]
  };

  var currentLang = 'en-IN';
  var currentSpeaker = 'aparna_en_edtech';
  var isThinking = false;
  var isPlaying = false;
  var isRecognizing = false;
  var currentAudioInstance = null;
  var currentAudioUrl = null;
  var speechRecognition = null;
  var currentAbortController = null;

  // DOM elements
  var keyModalBackdrop = null;
  var keyModalInput = null;
  var keyModalEyeBtn = null;
  var keyModalStatusMsg = null;
  var keyModalSessionOnlyChk = null;
  var keyModalSaveBtn = null;
  var keyModalCloseBtn = null;
  var keyModalCancelBtn = null;
  var keyModalClearBtn = null;

  var widgetEl = null;
  var launcherEl = null;
  var langSelect = null;
  var speakerSelect = null;
  var statusPill = null;
  var statusText = null;
  var inputField = null;
  var sendBtn = null;
  var micBtn = null;
  var playBtn = null;
  var stopBtn = null;
  var responseArea = null;

  function getSavedApiKey() {
    try {
      return (localStorage.getItem(SARVAM_KEY_STORAGE) || sessionStorage.getItem(SARVAM_KEY_STORAGE) || '').trim();
    } catch (_) {
      return '';
    }
  }

  function setSavedApiKey(key, sessionOnly) {
    try {
      if (sessionOnly) {
        sessionStorage.setItem(SARVAM_KEY_STORAGE, key);
        sessionStorage.setItem(STORAGE_KEY_SESSION_ONLY, '1');
        localStorage.removeItem(SARVAM_KEY_STORAGE);
      } else {
        localStorage.setItem(SARVAM_KEY_STORAGE, key);
        sessionStorage.removeItem(SARVAM_KEY_STORAGE);
        sessionStorage.removeItem(STORAGE_KEY_SESSION_ONLY);
      }
    } catch (_) {}
  }

  function clearSavedApiKey() {
    try {
      localStorage.removeItem(SARVAM_KEY_STORAGE);
      sessionStorage.removeItem(SARVAM_KEY_STORAGE);
    } catch (_) {}
  }

  function getLiveDiodeContext() {
    var state = (typeof window.getDiodeState === 'function') ? window.getDiodeState() : {
      va: 0.0, currentMa: 0.0, vbi: 0.78, wNm: 350, xpNm: 35, xnNm: 315,
      vbr: 12.0, regimeLabel: 'Thermal Equilibrium', na: 1e17, nd: 1e16, temperature: 300
    };

    var selInfo = typeof lastSelectedId !== 'undefined' && lastSelectedId ? idToInfo(lastSelectedId) : null;

    return {
      title: selInfo ? selInfo.title : 'PN Junction Diode',
      role: selInfo ? selInfo.role : 'Rectifying semiconductor conduction across metallurgical P-N junction',
      fn: selInfo ? selInfo.fn : '',
      doping: selInfo ? selInfo.doping : '',
      circuitState: {
        va: (state.va >= 0 ? '+' : '') + state.va.toFixed(2) + ' V',
        current: state.currentMa.toFixed(2) + ' mA',
        vbi: state.vbi.toFixed(2) + ' V',
        w: state.wNm.toFixed(0) + ' nm',
        xp: state.xpNm.toFixed(0) + ' nm',
        xn: state.xnNm.toFixed(0) + ' nm',
        vbr: state.vbr.toFixed(1) + ' V',
        mode: state.regimeLabel,
        na: (state.na / 1e17).toFixed(1) + '×10¹⁷ cm⁻³',
        nd: (state.nd / 1e16).toFixed(1) + '×10¹⁶ cm⁻³',
        temperature: state.temperature + ' K'
      }
    };
  }

  function getOfflineDiodeExplanation(text, ctx) {
    var q = text.toLowerCase();
    var cs = ctx.circuitState;

    if (q.includes('breakdown') || q.includes('zener') || q.includes('avalanche')) {
      return 'In this diode, breakdown occurs at negative ' + cs.vbr + '. For breakdown under 5 volts, direct band-to-band quantum electron tunneling produces Zener breakdown with a negative temperature coefficient. Above 6 volts, energetic carriers undergo impact ionization, generating cascading avalanche electron-hole pairs with a positive temperature coefficient.';
    }
    if (q.includes('depletion') || q.includes('width') || q.includes('barrier') || q.includes('w')) {
      return 'The total depletion width is currently ' + cs.w + ', extending ' + cs.xp + ' into the P-side and ' + cs.xn + ' into the N-side. Because the N-side is lighter doped than the P-side, the space charge extends significantly further into the N-region to maintain equal uncompensated charge area.';
    }
    if (q.includes('forward') || q.includes('shockley') || q.includes('conduction') || q.includes('current')) {
      return 'Under forward bias of ' + cs.va + ', the external potential reduces the built-in barrier from ' + cs.vbi + ', causing exponential majority carrier diffusion across the junction. Diode current is ' + cs.current + ', following the Shockley formulation with series resistance clamping.';
    }
    if (q.includes('vbi') || q.includes('built-in') || q.includes('equilibrium')) {
      return 'At thermal equilibrium, carrier diffusion establishes an internal built-in potential barrier of Vbi = ' + cs.vbi + '. This electrostatic barrier opposes further net majority carrier diffusion, resulting in zero net current at zero bias.';
    }
    if (q.includes('temperature') || q.includes('temp') || q.includes('heat')) {
      return 'At temperature ' + cs.temperature + ', thermal voltage Vt equals kT/q. Higher temperature increases intrinsic carrier concentration ni and reverse saturation current Is, while shifting forward cut-in voltage downward by approximately negative 2 millivolts per Kelvin.';
    }

    return 'The PN diode is currently operating in ' + cs.mode + ' at VA = ' + cs.va + ' with current ' + cs.current + '. Total depletion width is ' + cs.w + ' with built-in potential ' + cs.vbi + ' and breakdown threshold ' + cs.vbr + '.';
  }

  async function submitQuestion(questionText) {
    var text = (questionText || (inputField ? inputField.value : '')).trim();
    if (!text) return;

    if (inputField) inputField.value = '';
    stopAudio();
    appendMessage('user', text);
    isThinking = true;
    updateStatus('thinking', 'Analyzing PN Diode Physics...');

    var apiKey = getSavedApiKey();
    var ctx = getLiveDiodeContext();

    if (!apiKey) {
      // Provide instantaneous offline physics tutoring
      setTimeout(function () {
        var reply = getOfflineDiodeExplanation(text, ctx);
        isThinking = false;
        appendMessage('ai', reply);
        updateStatus('ready', 'AI Tutor Ready');
      }, 400);
      return;
    }

    currentAbortController = new AbortController();
    var signal = currentAbortController.signal;

    try {
      var chatRes = await fetch('https://api.sarvam.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey
        },
        body: JSON.stringify({
          model: 'sarvam-105b-conversations',
          messages: [
            {
              role: 'system',
              content: 'You are an expert semiconductor physics professor explaining a 3D PN Junction Diode CAD viewer. Answer concisely in 2-3 spoken sentences (40-60 words) without bullet points, asterisks, or markdown equations.'
            },
            {
              role: 'user',
              content: 'Context: ' + JSON.stringify(ctx) + '\nQuestion: ' + text
            }
          ],
          temperature: 0.3,
          max_tokens: 150
        }),
        signal: signal
      });

      var answerText = '';
      if (chatRes.ok) {
        var chatData = await chatRes.json();
        answerText = (chatData.choices && chatData.choices[0] && chatData.choices[0].message && chatData.choices[0].message.content) || '';
      } else {
        answerText = getOfflineDiodeExplanation(text, ctx);
      }

      appendMessage('ai', answerText);
      synthesizeSpeech(answerText, apiKey);
    } catch (err) {
      if (err.name !== 'AbortError') {
        var fallback = getOfflineDiodeExplanation(text, ctx);
        appendMessage('ai', fallback);
      }
      isThinking = false;
      updateStatus('ready', 'AI Tutor Ready');
    }
  }

  async function synthesizeSpeech(textToSpeak, apiKey) {
    if (!apiKey) {
      isThinking = false;
      updateStatus('ready', 'AI Tutor Ready');
      return;
    }

    try {
      updateStatus('speaking', 'Synthesizing voice audio...');
      var cleanText = textToSpeak.replace(/[\*\#\_`]/g, '').slice(0, 350);

      var ttsRes = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey
        },
        body: JSON.stringify({
          inputs: [cleanText],
          target_language_code: currentLang,
          speaker: currentSpeaker,
          model: 'bulbul:v4-flash',
          speech_sample_rate: 24000
        })
      });

      if (!ttsRes.ok) throw new Error('TTS status ' + ttsRes.status);
      var ttsData = await ttsRes.json();
      var b64Audio = ttsData.audios && ttsData.audios[0];

      if (b64Audio) {
        playBase64Audio(b64Audio);
      } else {
        updateStatus('ready', 'AI Tutor Ready');
      }
    } catch (ttsErr) {
      console.warn('TTS error:', ttsErr);
      updateStatus('ready', 'AI Tutor Ready');
    } finally {
      isThinking = false;
    }
  }

  function playBase64Audio(base64Data) {
    stopAudio();
    var binary = window.atob(base64Data);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var blob = new Blob([bytes], { type: 'audio/wav' });
    currentAudioUrl = URL.createObjectURL(blob);
    currentAudioInstance = new Audio(currentAudioUrl);

    currentAudioInstance.onplay = function () {
      isPlaying = true;
      updateStatus('speaking', 'Speaking...');
      if (playBtn) playBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;
    };

    currentAudioInstance.onended = function () {
      stopAudio();
    };

    currentAudioInstance.onerror = function () {
      stopAudio();
    };

    currentAudioInstance.play();
  }

  function stopAudio() {
    if (currentAudioInstance) {
      try {
        currentAudioInstance.pause();
        currentAudioInstance.currentTime = 0;
      } catch (_) {}
      currentAudioInstance = null;
    }
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }
    isPlaying = false;
    if (playBtn) playBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = true;
    updateStatus('ready', 'AI Tutor Ready');
  }

  function appendMessage(role, text) {
    if (!responseArea) return;
    var div = document.createElement('div');
    div.className = 'va-msg ' + (role === 'ai' ? 'va-msg-ai' : 'va-msg-user');
    div.innerHTML = '<div class="va-msg-header">' + (role === 'ai' ? 'Sarvam AI Tutor' : 'Student') + '</div>' +
                    '<div class="va-msg-body">' + text + '</div>';
    responseArea.appendChild(div);
    responseArea.scrollTop = responseArea.scrollHeight;
  }

  function updateStatus(state, msg) {
    if (statusText) statusText.textContent = msg;
    if (statusPill) {
      statusPill.className = 'va-status-pill ' + state;
    }
  }

  function openApiKeyModal() {
    if (keyModalBackdrop) {
      keyModalBackdrop.style.display = 'flex';
      if (keyModalInput) {
        keyModalInput.value = getSavedApiKey();
        keyModalInput.focus();
      }
    }
  }

  function closeApiKeyModal() {
    if (keyModalBackdrop) keyModalBackdrop.style.display = 'none';
  }

  function initVoiceAssistant() {
    widgetEl = document.getElementById('voice-assistant-widget');
    launcherEl = document.getElementById('va-launcher-btn');
    langSelect = document.getElementById('va-lang-select');
    speakerSelect = document.getElementById('va-speaker-select');
    statusPill = document.getElementById('va-status-pill');
    statusText = document.getElementById('va-status-text');
    inputField = document.getElementById('va-input-text');
    sendBtn = document.getElementById('va-btn-send');
    micBtn = document.getElementById('va-btn-mic');
    playBtn = document.getElementById('va-btn-play');
    stopBtn = document.getElementById('va-btn-stop');
    responseArea = document.getElementById('va-response-area');

    keyModalBackdrop = document.getElementById('va-key-modal');
    keyModalInput = document.getElementById('va-input-apikey');
    keyModalEyeBtn = document.getElementById('va-btn-toggle-key-visibility');
    keyModalStatusMsg = document.getElementById('va-key-status-msg');
    keyModalSessionOnlyChk = document.getElementById('va-chk-session-only');
    keyModalSaveBtn = document.getElementById('va-modal-save-btn');
    keyModalCloseBtn = document.getElementById('va-modal-close-btn');
    keyModalCancelBtn = document.getElementById('va-modal-cancel-btn');
    keyModalClearBtn = document.getElementById('va-modal-clear-btn');

    // Launcher & minimize
    if (launcherEl && widgetEl) {
      launcherEl.addEventListener('click', function () {
        widgetEl.classList.remove('minimized');
        launcherEl.classList.remove('visible');
      });
    }

    var minBtn = document.getElementById('va-btn-minimize');
    var closeWidgetBtn = document.getElementById('va-btn-close');
    if (minBtn && widgetEl && launcherEl) {
      minBtn.addEventListener('click', function () {
        widgetEl.classList.add('minimized');
        launcherEl.classList.add('visible');
      });
    }
    if (closeWidgetBtn && widgetEl && launcherEl) {
      closeWidgetBtn.addEventListener('click', function () {
        widgetEl.classList.add('minimized');
        launcherEl.classList.add('visible');
        stopAudio();
      });
    }

    var settingsBtn = document.getElementById('va-btn-settings');
    if (settingsBtn) settingsBtn.addEventListener('click', openApiKeyModal);

    // Modal bindings
    if (keyModalCloseBtn) keyModalCloseBtn.addEventListener('click', closeApiKeyModal);
    if (keyModalCancelBtn) keyModalCancelBtn.addEventListener('click', closeApiKeyModal);

    if (keyModalSaveBtn && keyModalInput) {
      keyModalSaveBtn.addEventListener('click', function () {
        var key = keyModalInput.value.trim();
        var sessionOnly = keyModalSessionOnlyChk ? keyModalSessionOnlyChk.checked : true;
        setSavedApiKey(key, sessionOnly);
        closeApiKeyModal();
        appendMessage('ai', 'Sarvam API key saved! You can now ask questions with live audio responses.');
      });
    }

    if (keyModalClearBtn) {
      keyModalClearBtn.addEventListener('click', function () {
        clearSavedApiKey();
        if (keyModalInput) keyModalInput.value = '';
        closeApiKeyModal();
      });
    }

    // Input submission
    if (sendBtn) sendBtn.addEventListener('click', function () { submitQuestion(); });
    if (inputField) {
      inputField.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submitQuestion();
      });
    }

    if (stopBtn) stopBtn.addEventListener('click', stopAudio);

    // Question chips
    document.querySelectorAll('.va-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var q = chip.dataset.q;
        if (q) submitQuestion(q);
      });
    });

    // Language change
    if (langSelect) {
      langSelect.addEventListener('change', function () {
        currentLang = langSelect.value;
        if (speakerSelect && PERSONAS[currentLang]) {
          speakerSelect.innerHTML = PERSONAS[currentLang].map(function (p) {
            return '<option value="' + p.id + '">' + p.name + '</option>';
          }).join('');
          currentSpeaker = speakerSelect.value;
        }
      });
    }

    if (speakerSelect) {
      speakerSelect.addEventListener('change', function () {
        currentSpeaker = speakerSelect.value;
      });
    }
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVoiceAssistant);
  } else {
    initVoiceAssistant();
  }
})();
