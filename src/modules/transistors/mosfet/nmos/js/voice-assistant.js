/**
 * voice-assistant.js - NMOS CAD Viewer
 * Sarvam AI Voice Assistant Tutor & Audio Narration Engine
 * - Full parity Sarvam AI API Key modal with test voice verification
 * - Speech-to-text (Web Speech STT) with active listening state and error reporting
 * - Text-to-speech (Sarvam Bulbul v4 Flash 24kHz) with play/pause/stop playback controls
 * - LLM tutoring powered by sarvam-105b-conversations
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
      { id: 'shubh_hi_customer', name: 'Shubh (Hindi Conversational)' },
      { id: 'ritu_hi_customer', name: 'Ritu (Hindi Casual)' }
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

  // Modal DOM elements
  var keyModalBackdrop = null;
  var keyModalTitle = null;
  var keyModalInput = null;
  var keyModalEyeBtn = null;
  var keyModalStatusMsg = null;
  var keyModalSessionOnlyChk = null;
  var keyModalClearBtn = null;
  var keyModalCancelBtn = null;
  var keyModalCloseBtn = null;
  var keyModalSaveBtn = null;
  var pendingActionCallback = null;

  // Widget DOM elements
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

  function base64ToWavBlob(base64Data) {
    var binaryString = window.atob(base64Data);
    var len = binaryString.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes.buffer], { type: 'audio/wav' });
  }

  function updateStatus(state, label) {
    if (statusPill && statusText) {
      statusPill.className = 'va-status-pill ' + state;
      statusText.textContent = label;
    }
    if (launcherEl) {
      launcherEl.classList.toggle('listening', state === 'listening');
      launcherEl.classList.toggle('speaking', state === 'speaking');
    }
  }

  function appendMessage(sender, text) {
    if (!responseArea) return null;
    var msg = document.createElement('div');
    msg.className = 'va-msg va-msg-' + sender;

    var header = document.createElement('div');
    header.className = 'va-msg-header';
    header.textContent = sender === 'user' ? 'You' : 'Sarvam AI NMOS Tutor';
    msg.appendChild(header);

    var body = document.createElement('div');
    body.className = 'va-msg-body';
    body.textContent = text;
    msg.appendChild(body);

    responseArea.appendChild(msg);
    responseArea.scrollTop = responseArea.scrollHeight;
    return msg;
  }

  function stopAudio() {
    if (currentAbortController) {
      try { currentAbortController.abort(); } catch (_) {}
      currentAbortController = null;
    }
    if (currentAudioInstance) {
      try {
        currentAudioInstance.pause();
        currentAudioInstance.currentTime = 0;
      } catch (_) {}
      currentAudioInstance = null;
    }
    if (currentAudioUrl) {
      try { URL.revokeObjectURL(currentAudioUrl); } catch (_) {}
      currentAudioUrl = null;
    }
    isPlaying = false;
    if (playBtn) {
      playBtn.textContent = '▶ Play';
      playBtn.disabled = true;
    }
    if (stopBtn) {
      stopBtn.disabled = true;
    }
    updateStatus('ready', 'AI Tutor Ready');
  }

  function togglePlayPause() {
    if (!currentAudioInstance) return;
    if (isPlaying) {
      currentAudioInstance.pause();
      isPlaying = false;
      if (playBtn) playBtn.textContent = '▶ Play';
      updateStatus('ready', 'Playback Paused');
    } else {
      currentAudioInstance.play().then(function () {
        isPlaying = true;
        if (playBtn) playBtn.textContent = '⏸ Pause';
        if (stopBtn) stopBtn.disabled = false;
        updateStatus('speaking', 'Speaking Voice...');
      }).catch(function (err) {
        console.error('Audio play error:', err);
        updateStatus('error', 'Playback blocked: ' + err.message);
      });
    }
  }

  function playAudioBlob(blob) {
    stopAudio();
    currentAudioUrl = URL.createObjectURL(blob);
    currentAudioInstance = new Audio(currentAudioUrl);

    currentAudioInstance.onended = function () {
      stopAudio();
    };
    currentAudioInstance.onerror = function (e) {
      console.error('Audio playback error:', e);
      updateStatus('error', 'Audio playback failed');
      stopAudio();
    };

    if (playBtn) {
      playBtn.disabled = false;
      playBtn.textContent = '⏸ Pause';
    }
    if (stopBtn) {
      stopBtn.disabled = false;
    }

    isPlaying = true;
    updateStatus('speaking', 'Speaking Voice...');

    currentAudioInstance.play().catch(function (err) {
      console.warn('Autoplay prevented by browser, click Play to listen:', err);
      isPlaying = false;
      if (playBtn) {
        playBtn.disabled = false;
        playBtn.textContent = '▶ Play';
      }
      updateStatus('ready', 'Voice Ready — Click ▶ Play');
    });
  }

  // =========================================================================
  // SPEECH-TO-TEXT (MIC INPUT)
  // =========================================================================
  function initSpeechRecognition() {
    var SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.error('Speech recognition (SpeechRecognition / webkitSpeechRecognition) not supported in this browser.');
      updateStatus('error', 'Speech recognition not supported');
      return null;
    }

    var recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = currentLang || 'en-IN';

    recognition.onstart = function () {
      isRecognizing = true;
      if (micBtn) {
        micBtn.classList.add('recording');
        micBtn.title = 'Listening... Click to finish speaking';
      }
      updateStatus('listening', 'Listening...');
    };

    recognition.onresult = function (event) {
      var transcript = '';
      for (var i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      if (inputField && transcript) {
        inputField.value = transcript;
      }
    };

    recognition.onerror = function (event) {
      isRecognizing = false;
      if (micBtn) {
        micBtn.classList.remove('recording');
        micBtn.title = 'Voice Input (Mic)';
      }
      var errMsg = event.error === 'not-allowed' ? 'Mic permission denied' : ('STT error: ' + event.error);
      console.error('Speech recognition error:', event.error, errMsg);
      updateStatus('error', errMsg);
    };

    recognition.onend = function () {
      isRecognizing = false;
      if (micBtn) {
        micBtn.classList.remove('recording');
        micBtn.title = 'Voice Input (Mic)';
      }
      if (inputField && inputField.value.trim()) {
        updateStatus('ready', 'Transcribed — Click Ask & Speak');
      } else {
        updateStatus('ready', 'AI Tutor Ready');
      }
    };

    return recognition;
  }

  function toggleSpeechRecognition() {
    if (isRecognizing && speechRecognition) {
      try {
        speechRecognition.stop();
      } catch (e) {
        console.error('Error stopping speech recognition:', e);
      }
      return;
    }

    if (!speechRecognition) {
      speechRecognition = initSpeechRecognition();
    }
    if (!speechRecognition) {
      alert('Speech-to-text recognition is not supported in this browser. Please type your question.');
      return;
    }

    stopAudio();
    speechRecognition.lang = currentLang || 'en-IN';
    try {
      speechRecognition.start();
    } catch (e) {
      console.error('Error starting speech recognition:', e);
      updateStatus('error', 'Mic error: ' + e.message);
    }
  }

  // =========================================================================
  // SARVAM AI API KEY MODAL
  // =========================================================================
  function openApiKeyModal(callback) {
    pendingActionCallback = typeof callback === 'function' ? callback : null;
    if (!keyModalBackdrop) return;

    var currentKey = getSavedApiKey();
    if (keyModalInput) {
      keyModalInput.value = currentKey;
      keyModalInput.type = 'password';
    }
    if (keyModalEyeBtn) {
      var showIcon = keyModalEyeBtn.querySelector('.eye-show');
      var hideIcon = keyModalEyeBtn.querySelector('.eye-hide');
      if (showIcon && hideIcon) {
        showIcon.style.display = 'block';
        hideIcon.style.display = 'none';
      }
    }
    if (keyModalStatusMsg) {
      keyModalStatusMsg.style.display = 'none';
      keyModalStatusMsg.textContent = '';
      keyModalStatusMsg.className = 'va-field-msg';
    }
    if (keyModalTitle) {
      keyModalTitle.textContent = currentKey ? 'Manage Sarvam AI API Key' : 'Sarvam AI API Key Required';
    }
    if (keyModalClearBtn) {
      keyModalClearBtn.style.display = currentKey ? 'inline-flex' : 'none';
    }
    if (keyModalSessionOnlyChk) {
      keyModalSessionOnlyChk.checked = sessionStorage.getItem(STORAGE_KEY_SESSION_ONLY) === '1' || !currentKey;
    }
    if (keyModalSaveBtn) {
      keyModalSaveBtn.disabled = false;
      keyModalSaveBtn.innerHTML = 'Save &amp; Test Voice';
    }

    keyModalBackdrop.style.display = 'flex';
    requestAnimationFrame(function () {
      keyModalBackdrop.classList.add('is-open');
      if (keyModalInput && keyModalInput.focus) keyModalInput.focus();
    });
  }

  function closeApiKeyModal() {
    if (!keyModalBackdrop) return;
    keyModalBackdrop.classList.remove('is-open');
    setTimeout(function () {
      keyModalBackdrop.style.display = 'none';
    }, 200);
  }

  function showModalStatus(type, message) {
    if (!keyModalStatusMsg) return;
    keyModalStatusMsg.className = 'va-field-msg ' + type;
    keyModalStatusMsg.textContent = message;
    keyModalStatusMsg.style.display = 'block';
  }

  async function handleSaveAndTestVoice() {
    var key = keyModalInput ? keyModalInput.value.trim() : '';
    if (!key) {
      showModalStatus('error', 'Please enter your personal Sarvam AI API subscription key.');
      if (keyModalInput && keyModalInput.focus) keyModalInput.focus();
      return;
    }

    if (keyModalSaveBtn) {
      keyModalSaveBtn.disabled = true;
      keyModalSaveBtn.innerHTML = 'Verifying with Sarvam...';
    }
    showModalStatus('info', 'Connecting to Sarvam AI voice service to verify credentials...');

    try {
      var res = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': key
        },
        body: JSON.stringify({
          inputs: ['Sarvam AI NMOS transistor voice tutor is ready.'],
          target_language_code: currentLang || 'en-IN',
          speaker: currentSpeaker || 'aparna_en_edtech',
          model: 'bulbul:v4-flash'
        })
      });

      if (!res.ok) {
        var errDetail = '';
        try {
          var errJson = await res.json();
          errDetail = (errJson.error && errJson.error.message) || errJson.message || JSON.stringify(errJson);
        } catch (e) {
          errDetail = await res.text();
        }
        throw new Error('Sarvam API error (' + res.status + '): ' + (errDetail || 'Invalid key'));
      }

      var data = await res.json();
      if (!data || !data.audios || !data.audios[0]) {
        throw new Error('No audio data returned by Sarvam API.');
      }

      var sessionOnly = keyModalSessionOnlyChk ? keyModalSessionOnlyChk.checked : true;
      setSavedApiKey(key, sessionOnly);

      showModalStatus('success', 'API key verified! Playing sample voice...');

      try {
        var blob = base64ToWavBlob(data.audios[0]);
        var testUrl = URL.createObjectURL(blob);
        var testAudio = new Audio(testUrl);
        testAudio.onended = function () { URL.revokeObjectURL(testUrl); };
        testAudio.play().catch(function () {});
      } catch (e) {}

      updateStatus('ready', 'AI Tutor Ready');

      setTimeout(function () {
        closeApiKeyModal();
        if (typeof pendingActionCallback === 'function') {
          var action = pendingActionCallback;
          pendingActionCallback = null;
          action();
        }
      }, 700);

    } catch (err) {
      console.error('[VoiceAssistant] Key verification error:', err);
      showModalStatus('error', 'Verification failed: ' + err.message + '. Please check dashboard.sarvam.ai');
      if (keyModalSaveBtn) {
        keyModalSaveBtn.disabled = false;
        keyModalSaveBtn.innerHTML = 'Save &amp; Test Voice';
      }
    }
  }

  // =========================================================================
  // SUBMIT PROMPT & TTS SYNTHESIS
  // =========================================================================
  async function submitQuestion(questionText) {
    var text = (questionText || (inputField ? inputField.value : '')).trim();
    if (!text) return;

    var apiKey = getSavedApiKey();
    if (!apiKey) {
      openApiKeyModal(function () {
        submitQuestion(text);
      });
      return;
    }

    if (inputField) inputField.value = '';
    stopAudio();
    appendMessage('user', text);
    isThinking = true;
    updateStatus('thinking', 'Sarvam 105B Reasoning...');

    currentAbortController = new AbortController();
    var signal = currentAbortController.signal;

    try {
      var selInfo = typeof lastSelectedId !== 'undefined' && lastSelectedId ? idToInfo(lastSelectedId) : null;
      var contextPayload = {
        title: selInfo ? selInfo.title : 'NMOS Transistor',
        role: selInfo ? selInfo.role : 'N-channel field-effect transistor conduction control',
        fn: selInfo ? selInfo.fn : '',
        doping: selInfo ? selInfo.doping : '',
        circuitState: {
          vgs: currentIn === 1 ? '1.0V (ON)' : (currentIn === 0 ? '0.0V (OFF)' : 'FLOATING'),
          channel: currentIn === 1 ? 'INVERSION LAYER (CONDUCTING)' : 'CUTOFF (DEPLETION)'
        }
      };

      // Query Sarvam LLM
      var answerText = '';
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
                content: 'You are an expert VLSI educator explaining a 3D NMOS Transistor CAD layout. Provide a concise, engaging spoken explanation (2-3 sentences, 40-60 words) answering the student question naturally without bullet points, asterisks, or markdown equations.'
              },
              {
                role: 'user',
                content: 'Context: ' + JSON.stringify(contextPayload) + '\nQuestion: ' + text
              }
            ],
            temperature: 0.3,
            max_tokens: 150
          }),
          signal: signal
        });

        if (chatRes.ok) {
          var chatData = await chatRes.json();
          answerText = (chatData.choices && chatData.choices[0] && chatData.choices[0].message && chatData.choices[0].message.content) || '';
        } else {
          var chatErr = await chatRes.text();
          console.error('Sarvam LLM status ' + chatRes.status + ':', chatErr);
        }
      } catch (chatFetchErr) {
        console.error('Sarvam LLM fetch error:', chatFetchErr);
      }

      if (!answerText) {
        answerText = 'The NMOS transistor operates by applying gate voltage VGS to invert the P-substrate surface into an electron channel between the N-plus source and drain.';
      }

      isThinking = false;
      appendMessage('ai', answerText);
      updateStatus('synthesizing', 'Synthesizing 24kHz Voice...');

      // Synthesize audio via Sarvam TTS
      var ttsRes = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey
        },
        body: JSON.stringify({
          inputs: [answerText],
          target_language_code: currentLang || 'en-IN',
          speaker: currentSpeaker || 'aparna_en_edtech',
          model: 'bulbul:v4-flash'
        }),
        signal: signal
      });

      if (ttsRes.ok) {
        var ttsData = await ttsRes.json();
        if (ttsData && ttsData.audios && ttsData.audios[0]) {
          var audioBlob = base64ToWavBlob(ttsData.audios[0]);
          playAudioBlob(audioBlob);
        } else {
          console.error('Sarvam TTS returned empty audio payload:', ttsData);
          updateStatus('error', 'TTS returned empty audio');
        }
      } else {
        var ttsErr = await ttsRes.text();
        console.error('Sarvam TTS returned status ' + ttsRes.status + ':', ttsErr);
        updateStatus('error', 'TTS failed (' + ttsRes.status + ')');
      }

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[VoiceAssistant] Error:', err);
      updateStatus('error', 'Tutor error: ' + (err.message || 'Request failed'));
    }
  }

  // =========================================================================
  // INITIALIZATION & DOM BINDINGS
  // =========================================================================
  function updateSpeakerOptions(lang) {
    if (!speakerSelect) return;
    speakerSelect.innerHTML = '';
    var list = PERSONAS[lang] || PERSONAS['en-IN'];
    list.forEach(function (item, idx) {
      var opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.name;
      if (idx === 0) {
        opt.selected = true;
        currentSpeaker = item.id;
      }
      speakerSelect.appendChild(opt);
    });
  }

  function init() {
    widgetEl = document.getElementById('voice-assistant-widget');
    launcherEl = document.getElementById('va-launcher-btn');
    langSelect = document.getElementById('va-lang-select');
    speakerSelect = document.getElementById('va-speaker-select');
    statusPill = document.getElementById('va-status-pill');
    statusText = document.getElementById('va-status-text');
    inputField = document.getElementById('va-input-text') || document.getElementById('va-input');
    sendBtn = document.getElementById('va-btn-send');
    micBtn = document.getElementById('va-btn-mic');
    playBtn = document.getElementById('va-btn-play');
    stopBtn = document.getElementById('va-btn-stop');
    responseArea = document.getElementById('va-response-area');

    // Modal elements
    keyModalBackdrop = document.getElementById('va-key-modal');
    keyModalTitle = document.getElementById('va-modal-title');
    keyModalInput = document.getElementById('va-input-apikey');
    keyModalEyeBtn = document.getElementById('va-btn-toggle-key-visibility');
    keyModalStatusMsg = document.getElementById('va-key-status-msg');
    keyModalSessionOnlyChk = document.getElementById('va-chk-session-only');
    keyModalClearBtn = document.getElementById('va-modal-clear-btn');
    keyModalCancelBtn = document.getElementById('va-modal-cancel-btn');
    keyModalCloseBtn = document.getElementById('va-modal-close-btn');
    keyModalSaveBtn = document.getElementById('va-modal-save-btn');
    var settingsBtn = document.getElementById('va-btn-settings');

    // Language & Speaker Persona change listeners
    if (langSelect) {
      langSelect.addEventListener('change', function () {
        currentLang = langSelect.value;
        updateSpeakerOptions(currentLang);
        if (speechRecognition) speechRecognition.lang = currentLang;
      });
    }

    if (speakerSelect) {
      speakerSelect.addEventListener('change', function () {
        currentSpeaker = speakerSelect.value;
      });
    }

    // Microphone STT button
    if (micBtn) {
      micBtn.addEventListener('click', function () {
        toggleSpeechRecognition();
      });
    }

    // Audio Play / Stop buttons
    if (playBtn) {
      playBtn.addEventListener('click', function () {
        togglePlayPause();
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', stopAudio);
    }

    // Launcher button (toggle open / minimized)
    if (launcherEl && widgetEl) {
      launcherEl.addEventListener('click', function () {
        var isOpen = widgetEl.classList.contains('open') && !widgetEl.classList.contains('minimized');
        if (isOpen) {
          widgetEl.classList.add('minimized');
          widgetEl.classList.remove('open');
          launcherEl.classList.remove('active');
        } else {
          widgetEl.classList.remove('minimized');
          widgetEl.classList.add('open');
          launcherEl.classList.add('active');
          if (inputField) inputField.focus();
        }
      });
    }

    // Minimize button
    var minBtn = document.getElementById('va-btn-minimize');
    if (minBtn && widgetEl) {
      minBtn.addEventListener('click', function () {
        widgetEl.classList.add('minimized');
        widgetEl.classList.remove('open');
        if (launcherEl) {
          launcherEl.classList.remove('active');
        }
      });
    }

    // Close button
    var hdrClose = document.getElementById('va-btn-close') || document.getElementById('va-hdr-close');
    if (hdrClose && widgetEl) {
      hdrClose.addEventListener('click', function () {
        stopAudio();
        widgetEl.classList.add('minimized');
        widgetEl.classList.remove('open');
        if (launcherEl) {
          launcherEl.classList.remove('active');
        }
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', function () {
        openApiKeyModal();
      });
    }

    if (keyModalCloseBtn) keyModalCloseBtn.addEventListener('click', closeApiKeyModal);
    if (keyModalCancelBtn) keyModalCancelBtn.addEventListener('click', closeApiKeyModal);
    if (keyModalBackdrop) {
      keyModalBackdrop.addEventListener('click', function (e) {
        if (e.target === keyModalBackdrop) closeApiKeyModal();
      });
    }

    if (keyModalEyeBtn && keyModalInput) {
      keyModalEyeBtn.addEventListener('click', function () {
        var showIcon = keyModalEyeBtn.querySelector('.eye-show');
        var hideIcon = keyModalEyeBtn.querySelector('.eye-hide');
        if (keyModalInput.type === 'password') {
          keyModalInput.type = 'text';
          if (showIcon && hideIcon) {
            showIcon.style.display = 'none';
            hideIcon.style.display = 'block';
          }
        } else {
          keyModalInput.type = 'password';
          if (showIcon && hideIcon) {
            showIcon.style.display = 'block';
            hideIcon.style.display = 'none';
          }
        }
      });
    }

    if (keyModalSaveBtn) keyModalSaveBtn.addEventListener('click', handleSaveAndTestVoice);
    if (keyModalInput) {
      keyModalInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSaveAndTestVoice();
        }
      });
    }

    if (keyModalClearBtn) {
      keyModalClearBtn.addEventListener('click', function () {
        clearSavedApiKey();
        if (keyModalInput) keyModalInput.value = '';
        keyModalClearBtn.style.display = 'none';
        showModalStatus('info', 'API key cleared.');
        updateStatus('ready', 'AI Tutor Ready (Key Req.)');
      });
    }

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && keyModalBackdrop && keyModalBackdrop.classList.contains('is-open')) {
        closeApiKeyModal();
      }
    });

    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        submitQuestion();
      });
    }

    if (inputField) {
      inputField.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitQuestion();
        }
      });
    }

    // Quick Prompt Chips
    document.querySelectorAll('.va-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var prompt = chip.dataset.q || chip.dataset.prompt || chip.textContent.trim();
        if (prompt === 'Explain Selected' || chip.id === 'va-chip-selected') {
          var sel = typeof lastSelectedId !== 'undefined' && lastSelectedId ? idToInfo(lastSelectedId) : null;
          prompt = sel ? 'Explain the physical and electrical role of the ' + sel.title + ' in this NMOS transistor.' : 'Explain the complete operating mechanism of this discrete NMOS transistor.';
        }
        submitQuestion(prompt);
      });
    });

    if (!getSavedApiKey()) {
      updateStatus('ready', 'AI Tutor Ready (Key Req.)');
    } else {
      updateStatus('ready', 'AI Tutor Ready');
    }
  }

  window.addEventListener('DOMContentLoaded', init);

  window.updateVoiceAssistantContext = function (id, info) {
    var ctxVal = document.getElementById('va-ctx-val');
    var ctxState = document.getElementById('va-ctx-state');
    if (ctxVal) ctxVal.textContent = (info ? info.title : id) || 'None';
    if (ctxState) {
      ctxState.textContent = 'VGS: ' + (currentIn === 1 ? '1.0V (ON)' : (currentIn === 0 ? '0.0V (OFF)' : 'FLT'));
    }
  };

  window.clearVoiceAssistantContext = function () {
    var ctxVal = document.getElementById('va-ctx-val');
    var ctxState = document.getElementById('va-ctx-state');
    if (ctxVal) ctxVal.textContent = 'None';
    if (ctxState) ctxState.textContent = 'VGS: ' + (currentIn === 1 ? '1.0V (ON)' : (currentIn === 0 ? '0.0V (OFF)' : 'FLT'));
  };

  window.openSarvamApiKeyModal = openApiKeyModal;
})();
