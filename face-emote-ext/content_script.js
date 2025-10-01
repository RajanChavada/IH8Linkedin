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
  let faceapi = null; // Will hold the imported face-api

  // Replace your current ensureFaceApi function with this implementation
async function ensureFaceApi() {
  return new Promise((resolve, reject) => {
    // Create a unique message namespace for this instance
    const namespace = `face-api-bridge-${Date.now()}`;
    
    // Get the URLs for our resources
    const bridgeScriptUrl = chrome.runtime.getURL('face-api-bridge.js');
    const faceApiUrl = chrome.runtime.getURL('face-api.min.js');
    
    // Create a message channel to communicate with the injected script
    const channel = new BroadcastChannel(namespace);
    
    // Set up listener for messages from the bridge
    channel.onmessage = (event) => {
      const { type, data } = event.data;
      
      if (type === 'FACE_API_READY') {
        // Create and return our proxy API
        const proxyAPI = createProxyAPI(channel, namespace);
        resolve(proxyAPI);
      } else if (type === 'FACE_API_ERROR') {
        reject(new Error(data.message));
      }
    };
    
    // Add message namespace as URL parameter so the bridge knows which channel to use
    const scriptElement = document.createElement('script');
    scriptElement.src = `${bridgeScriptUrl}?namespace=${namespace}&apiUrl=${encodeURIComponent(faceApiUrl)}`;
    scriptElement.onerror = () => reject(new Error('Failed to load bridge script'));
    document.head.appendChild(scriptElement);
    
    // Set timeout for loading
    setTimeout(() => {
      reject(new Error('Timed out waiting for face-api to initialize'));
    }, 10000);
  });
}

// Create a proxy API that sends requests through the message channel
function createProxyAPI(channel, namespace) {
  return {
    nets: {
      tinyFaceDetector: {
        loadFromUri: (uri) => sendRequest(channel, 'loadModel', ['tinyFaceDetector', uri])
      },
      faceExpressionNet: {
        loadFromUri: (uri) => sendRequest(channel, 'loadModel', ['faceExpressionNet', uri])
      }
    },
    TinyFaceDetectorOptions: function(options) {
      this.inputSize = options.inputSize;
      this.scoreThreshold = options.scoreThreshold;
    },
    detectSingleFace: (videoEl, options) => {
      // Ensure video has an ID for reference
      if (!videoEl.id) {
        videoEl.id = `face-api-video-${Date.now()}`;
      }
      
      // We'll attach the withFaceExpressions method to the returned promise
      const promise = sendRequest(channel, 'detectFace', [
        videoEl.id, 
        {
          inputSize: options.inputSize,
          scoreThreshold: options.scoreThreshold
        }
      ]);
      
      // Add the withFaceExpressions method
      promise.withFaceExpressions = () => promise;
      
      return promise;
    }
  };
}

// Helper function to send requests through the channel
function sendRequest(channel, method, args) {
  return new Promise((resolve, reject) => {
    const requestId = Date.now() + Math.random().toString(36).substr(2, 9);
    
    // Create a one-time message handler for this request
    const handler = (event) => {
      const { type, data } = event.data;
      if (type !== 'RESPONSE' || data.requestId !== requestId) return;
      
      // Remove this listener once we get our response
      channel.removeEventListener('message', handler);
      
      if (data.error) {
        reject(new Error(data.error));
      } else {
        resolve(data.result);
      }
    };
    
    channel.addEventListener('message', handler);
    
    // Send the request
    channel.postMessage({
      type: 'REQUEST',
      data: {
        method,
        args,
        requestId
      }
    });
    
    // Set timeout
    setTimeout(() => {
      channel.removeEventListener('message', handler);
      reject(new Error(`Request timeout for method: ${method}`));
    }, 10000);
  });
}


  // load local model files from extension
  async function loadModels() {
    if (!faceapi) {
      throw new Error('Face API not loaded');
    }
    
    const base = chrome.runtime.getURL('models');
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri(base);
      await faceapi.nets.faceExpressionNet.loadFromUri(base);
      console.log('Face detection models loaded successfully');
    } catch (err) {
      console.error('Error loading models:', err);
      throw err;
    }
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
    // Assign the returned faceapi to the local variable
    faceapi = await ensureFaceApi();
    await loadModels();
    await startCamera();

    running = true;
    consecutiveMs = 0;

    detectionInterval = setInterval(async () => {
      if (!running) return;
      if (videoEl.readyState < 2) return;
      try {
        // Run detection directly in content script context
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
      if (!running) startDetection();
      sendResponse({success: true});
    } else if (msg.type === 'stop-detection') {
      stopAll();
      sendResponse({success: true});
    }
  });

  // ensure we react to unload
  window.addEventListener('beforeunload', stopAll);
}

// Avoid running multiple times
if (window.emotionDetectionActive) {
  console.log('Emotion detection already active on this page');
} else {
  window.emotionDetectionActive = true;
  console.log('LinkedIn detected - initializing emotion detection');
  
  // Create container for the emotion detection panel
  const container = document.createElement('div');
  container.id = 'ih8linkedin-container';
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 280px;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
    padding: 15px;
    z-index: 9999;
    font-family: 'Inter', sans-serif;
    color: #f8f9fa;
  `;
  
  // Add header
  const header = document.createElement('div');
  header.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div style="font-size: 16px; font-weight: 600; background: linear-gradient(to right, #a5f3fc, #0ea5e9); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">IH8LinkedIn</div>
      <div id="close-emotion-panel" style="cursor: pointer; padding: 5px; font-size: 16px;">✕</div>
    </div>
    <div style="font-size: 12px; opacity: 0.7; margin-bottom: 10px;">Emotion detection active</div>
  `;
  container.appendChild(header);
  
  // Add video element
  const videoContainer = document.createElement('div');
  videoContainer.style.cssText = `
    position: relative;
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 15px;
    border: 1px solid rgba(255, 255, 255, 0.25);
  `;
  
  const video = document.createElement('video');
  video.id = 'ih8linkedin-video';
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.style.cssText = `
    width: 100%;
    height: 140px;
    object-fit: cover;
    display: block;
    background-color: #0d1117;
  `;
  videoContainer.appendChild(video);
  
  const status = document.createElement('div');
  status.style.cssText = `
    position: absolute;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.5);
    padding: 5px 10px;
    border-radius: 20px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 5px;
  `;
  
  const statusDot = document.createElement('span');
  statusDot.style.cssText = `
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #10b981;
    display: inline-block;
    animation: pulse 2s infinite;
  `;
  
  const statusText = document.createElement('span');
  statusText.id = 'ih8linkedin-status';
  statusText.textContent = 'Initializing...';
  
  status.appendChild(statusDot);
  status.appendChild(statusText);
  videoContainer.appendChild(status);
  
  container.appendChild(videoContainer);
  
  // Add emotion display
  const emotionDisplay = document.createElement('div');
  emotionDisplay.id = 'ih8linkedin-emotion';
  emotionDisplay.style.cssText = `
    padding: 10px;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.15);
    font-size: 14px;
    text-align: center;
  `;
  emotionDisplay.textContent = 'Starting detection...';
  container.appendChild(emotionDisplay);
  
  // Add action button
  const actionButton = document.createElement('button');
  actionButton.id = 'ih8linkedin-toggle';
  actionButton.style.cssText = `
    background: linear-gradient(135deg, #3371e3, #5e60ce);
    color: white;
    border: none;
    padding: 10px 0;
    border-radius: 25px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    width: 100%;
    margin-top: 15px;
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(51, 113, 227, 0.3);
  `;
  actionButton.innerHTML = 'Pause Detection';
  container.appendChild(actionButton);
  
  // Add to page
  document.body.appendChild(container);
  
  // Add animation style
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(styleSheet);
  
  // Load font
  const fontLink = document.createElement('link');
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap';
  fontLink.rel = 'stylesheet';
  document.head.appendChild(fontLink);
  
  // Load face-api.js
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  // Configuration for emotion detection
  const config = {
    targetEmotion: 'sad',      // Which emotion to monitor
    threshold: 0.6,            // Threshold (0-1) for emotion detection
    minDuration: 3,            // How many seconds the emotion must persist
    cooldownPeriod: 10,        // Seconds before another action can trigger
  };
  
  // Variables
  let emotionCounter = 0;
  let lastActionTime = 0;
  let detectionActive = false;
  let detectionInterval = null;
  let faceapi = null;
  
  // Initialize detection
  async function initialize() {
    try {
      // Check for WebGL support first
      if (!isWebGLSupported()) {
        throw new Error("WebGL is not supported on this device");
      }
      
      // Use the existing ensureFaceApi function from the first part of your code
      faceapi = await ensureFaceApi();
      
      document.getElementById('ih8linkedin-status').textContent = "Connecting camera...";
      
      // Start camera
      const cameraStarted = await startCamera();
      if (!cameraStarted) {
        throw new Error("Failed to start camera");
      }
      
      // Load models
      document.getElementById('ih8linkedin-status').textContent = "Loading models...";
      await loadModels();
      
      // Start detection
      startDetection();
      
      // Set up event listeners
      document.getElementById('ih8linkedin-toggle').addEventListener('click', toggleDetection);
      document.getElementById('close-emotion-panel').addEventListener('click', closePanel);
      
    } catch (error) {
      console.error('Initialization error:', error);
      document.getElementById('ih8linkedin-status').textContent = 'Error';
      document.getElementById('ih8linkedin-emotion').textContent = `Error: ${error.message}`;
      
      // Show detailed error message and fallback option
      const emotionDisplay = document.getElementById('ih8linkedin-emotion');
      emotionDisplay.innerHTML = `
        <div style="color: #ef4444; font-weight: 500; margin-bottom: 8px;">
          ${error.message}
        </div>
        <div style="font-size: 12px; opacity: 0.8;">
          Try using Chrome or Edge on a desktop device
        </div>
      `;
    }
  }
  
  // Add WebGL detection function
  function isWebGLSupported() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && 
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch(e) {
      return false;
    }
  }
  
  // Update loadModels function to use the bridge API properly
  async function loadModels() {
    try {
      if (!faceapi || !faceapi.nets) {
        throw new Error('Face API not properly initialized');
      }
      
      document.getElementById('ih8linkedin-status').textContent = "Loading models...";
      
      // Use the models from extension
      const base = chrome.runtime.getURL('models');
      await faceapi.nets.tinyFaceDetector.loadFromUri(base);
      await faceapi.nets.faceExpressionNet.loadFromUri(base);
      
      document.getElementById('ih8linkedin-status').textContent = "Ready";
      return true;
    } catch (error) {
      console.error("Error loading models:", error);
      document.getElementById('ih8linkedin-status').textContent = "Model error";
      throw error;
    }
  }
  
  // Update startDetection to handle possible errors
  function startDetection() {
    if (detectionActive || !faceapi) return;
    
    const video = document.getElementById('ih8linkedin-video');
    const emotionDisplay = document.getElementById('ih8linkedin-emotion');
    const statusText = document.getElementById('ih8linkedin-status');
    
    detectionActive = true;
    statusText.textContent = "Active";
    
    // Start detection loop
    detectionInterval = setInterval(async () => {
      try {
        if (!faceapi || !video.readyState || video.readyState < 2) {
          return; // Skip detection if video or API not ready
        }
        
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
        const result = await faceapi
          .detectSingleFace(video, options)
          .withFaceExpressions();

        if (result && result.expressions) {
          const emotions = result.expressions;
          
          // Get the strongest emotion
          const strongestEmotion = Object.entries(emotions).reduce(
            (prev, current) => (prev[1] > current[1]) ? prev : current
          );
          
          // Update the emotion display with the strongest emotion
          emotionDisplay.textContent = `${strongestEmotion[0]}: ${(strongestEmotion[1] * 100).toFixed(0)}%`;
          
          // Style based on emotion
          const emotionColors = {
            happy: '#10b981',
            sad: '#3b82f6',
            angry: '#ef4444',
            disgusted: '#8b5cf6',
            surprised: '#f59e0b',
            fearful: '#6366f1',
            neutral: '#6b7280'
          };
          
          emotionDisplay.style.background = `rgba(0,0,0,0.15)`;
          emotionDisplay.style.borderLeft = `4px solid ${emotionColors[strongestEmotion[0]] || '#6b7280'}`;
          
          // Check for target emotion
          const targetScore = emotions[config.targetEmotion] || 0;
          
          // Check if target emotion is strong enough
          if (targetScore >= config.threshold) {
            emotionCounter++;
            
            // Show progress towards action trigger
            const progress = emotionCounter / config.minDuration;
            emotionDisplay.textContent = `${config.targetEmotion} detected (${emotionCounter}/${config.minDuration})`;
            emotionDisplay.style.background = `linear-gradient(to right, rgba(16, 185, 129, 0.2) ${progress*100}%, rgba(0,0,0,0.15) ${progress*100}%)`;
            
            // If emotion has persisted long enough, trigger action
            if (emotionCounter >= config.minDuration) {
              console.log("Triggering action!");
              
              // Visual feedback
              emotionDisplay.textContent = `${config.targetEmotion} detected! Taking action...`;
              emotionDisplay.style.background = `rgba(16, 185, 129, 0.2)`;
              emotionDisplay.style.borderLeft = `4px solid #10b981`;
              
              // Open a new tab with uplifting content
              window.open('https://www.youtube.com/results?search_query=cute+animals+funny', '_blank');
              
              // Reset counter after triggering
              emotionCounter = 0;
              lastActionTime = Date.now();
            }
          } else {
            // Reset counter if emotion not detected
            emotionCounter = 0;
          }
        }
      } catch (error) {
        console.error("Detection error:", error);
        statusText.textContent = "Error";
      }
    }, 1000);
  }
  
  function stopDetection() {
    if (detectionInterval) {
      clearInterval(detectionInterval);
      detectionInterval = null;
    }
    
    document.getElementById('ih8linkedin-status').textContent = "Paused";
    detectionActive = false;
  }
  
  function toggleDetection() {
    const button = document.getElementById('ih8linkedin-toggle');
    
    if (detectionActive) {
      stopDetection();
      button.textContent = 'Resume Detection';
    } else {
      startDetection();
      button.textContent = 'Pause Detection';
    }
  }
  
  function closePanel() {
    // Stop detection and remove panel
    stopDetection();
    
    // Stop camera
    const video = document.getElementById('ih8linkedin-video');
    if (video.srcObject) {
      const tracks = video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    
    // Remove the panel
    const container = document.getElementById('ih8linkedin-container');
    if (container) {
      container.remove();
    }
    
    window.emotionDetectionActive = false;
  }
  
  // Start everything
  initialize();
}
