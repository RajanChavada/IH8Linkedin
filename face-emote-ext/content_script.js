// content_script.js
// Avoid loading twice
if (window.__moodguard_loaded) {
  // already injected -> continue
} else {
  window.__moodguard_loaded = true;

  // Configuration defaults (overwritten by popup message)
  let config = {
    emotion: 'sad',
    threshold: 0.6,
    hold: 2.0,
    actionType: 'notify'
  };

  let running = false;
  let videoEl = null;
  let detectionInterval = null;
  let consecutiveMs = 0;
  const CHECK_MS = 200; // how often to run detection

  // helper to load script
  function loadScript(url) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = res;
      s.onerror = rej;
      (document.head || document.documentElement).appendChild(s);
    });
  }

  // load face-api CDN
  async function ensureFaceApi() {
    if (!window.faceapi) {
      // Using unpkg CDN for face-api.js (which bundles TF.js). 
      // If you prefer to include files inside the extension, change this to local files.
      await loadScript('https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js');
    }
  }

  // load local model files from extension (recommended)
  async function loadModels() {
    // models should be included in your extension folder under /models
    // we will load from chrome.runtime.getURL
    const base = chrome.runtime.getURL('models');
    await faceapi.nets.tinyFaceDetector.loadFromUri(base);
    await faceapi.nets.faceExpressionNet.loadFromUri(base);
    // optionally load landmark/net if needed
    // await faceapi.nets.faceLandmark68Net.loadFromUri(base);
  }

  function createVideo() {
    videoEl = document.createElement('video');
    videoEl.style.position = 'fixed';
    videoEl.style.right = '8px';
    videoEl.style.bottom = '8px';
    videoEl.style.width = '160px';
    videoEl.style.height = '120px';
    videoEl.style.zIndex = 2147483647;
    videoEl.style.border = '2px solid rgba(0,0,0,0.5)';
    videoEl.autoplay = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
    document.body.appendChild(videoEl);
  }

  async function startCamera() {
    if (!videoEl) createVideo();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoEl.srcObject = stream;
      await videoEl.play();
    } catch (err) {
      console.error('Cannot access camera', err);
      alert('Camera access is required for MoodGuard to work.');
      stopAll();
    }
  }

  async function startDetection() {
    await ensureFaceApi();
    await loadModels();
    await startCamera();

    running = true;
    consecutiveMs = 0;

    detectionInterval = setInterval(async () => {
      if (!running) return;
      if (videoEl.readyState < 2) return;
      try {
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
        const result = await faceapi
          .detectSingleFace(videoEl, options)
          .withFaceExpressions();

        if (!result || !result.expressions) {
          consecutiveMs = 0;
          return;
        }

        const expressions = result.expressions;
        const prob = expressions[config.emotion] || 0;
        if (prob >= config.threshold) {
          consecutiveMs += CHECK_MS;
          if (consecutiveMs >= config.hold * 1000) {
            // Trigger once, then pause for a cooldown
            triggerAction(config.emotion);
            consecutiveMs = 0;
            // simple cooldown to avoid spamming: stop for 8 seconds
            running = false;
            setTimeout(() => { running = true; }, 8000);
          }
        } else {
          consecutiveMs = 0;
        }
      } catch (e) {
        console.error('detect error', e);
      }
    }, CHECK_MS);
  }

  function triggerAction(emotion) {
    chrome.runtime.sendMessage({
      type: 'emotion-trigger',
      payload: {
        emotion,
        tabId: (typeof chrome?.tabs !== 'undefined' ? null : null), // background gets actual tabId from sender
        action: buildAction(config.actionType)
      }
    });

    // Also try to get our tab id by messaging the background with a request from content script
    chrome.runtime.sendMessage({ type: 'query-tab' }, (resp) => {
      // background will ignore if not implemented
    });

    // Better: use chrome.runtime.getURL to send with the tabId in the same message:
    chrome.runtime.sendMessage({
      type: 'emotion-trigger',
      payload: {
        emotion,
        tabId: (window.__moodguard_tabId || null),
        action: buildAction(config.actionType)
      }
    });
  }

  function buildAction(actionType) {
    if (actionType === 'notify') {
      return { message: 'Hey — you look sad. Take a pause.' };
    }
    if (actionType === 'close') {
      return { closeTab: true, message: 'Closing this tab to save your mood.' };
    }
    if (actionType === 'open_happy') {
      return {
        openUrl: 'https://www.youtube.com/results?search_query=feel+good+videos',
        message: 'Opening a feel-good video!'
      };
    }
    return {};
  }

  function stopAll() {
    running = false;
    if (detectionInterval) {
      clearInterval(detectionInterval);
      detectionInterval = null;
    }
    if (videoEl && videoEl.srcObject) {
      const tracks = videoEl.srcObject.getTracks();
      tracks.forEach(t => t.stop());
      videoEl.remove();
      videoEl = null;
    }
    window.__moodguard_loaded = false;
  }

  // messages from popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'start-detection') {
      const p = msg.payload;
      config = {
        emotion: p.emotion || config.emotion,
        threshold: p.threshold || config.threshold,
        hold: p.hold || config.hold,
        actionType: p.actionType || config.actionType
      };
      // store tab id for background actions
      if (sender?.tab?.id) {
        window.__moodguard_tabId = sender.tab.id;
      }
      if (!running) startDetection();
    } else if (msg.type === 'stop-detection') {
      stopAll();
    }
  });

  // ensure we react to unload
  window.addEventListener('beforeunload', stopAll);
}
