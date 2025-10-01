// Check if the script has already been loaded
if (window.__face_api_bridge_loaded) {
  console.log('Face API bridge already loaded');
} else {
  window.__face_api_bridge_loaded = true;
  
  // Get the namespace and API URL from URL params
  const urlParams = new URLSearchParams(location.search);
  const namespace = urlParams.get('namespace');
  const faceApiUrl = urlParams.get('apiUrl');

  // Create communication channel
  const channel = new BroadcastChannel(namespace);

  // Track face-api loading status
  let faceApiLoaded = false;

  // Load face-api.js
  (function loadFaceApi() {
    const script = document.createElement('script');
    script.src = faceApiUrl;
    
    script.onload = () => {
      if (window.faceapi) {
        faceApiLoaded = true;
        channel.postMessage({
          type: 'FACE_API_READY'
        });
      } else {
        channel.postMessage({
          type: 'FACE_API_ERROR',
          data: { message: 'face-api.js loaded but API not available' }
        });
      }
    };
    
    script.onerror = (err) => {
      channel.postMessage({
        type: 'FACE_API_ERROR',
        data: { message: 'Failed to load face-api.js' }
      });
    };
    
    document.head.appendChild(script);
  })();

  // Handle requests from content script
  channel.onmessage = (event) => {
    const { type, data } = event.data;
    
    if (type !== 'REQUEST') return;
    
    const { method, args, requestId } = data;
    
    if (!faceApiLoaded) {
      sendResponse({ error: 'face-api not loaded', requestId });
      return;
    }
    
    try {
      // Handle model loading
      if (method === 'loadModel') {
        const modelName = args[0];
        const modelPath = args[1];
        
        window.faceapi.nets[modelName].loadFromUri(modelPath)
          .then(() => {
            sendResponse({ result: true, requestId });
          })
          .catch(err => {
            sendResponse({ error: err.message, requestId });
          });
        return;
      }
      
      // Handle face detection
      if (method === 'detectFace') {
        const videoEl = document.getElementById(args[0]);
        const options = args[1];
        
        window.faceapi.detectSingleFace(
          videoEl, 
          new window.faceapi.TinyFaceDetectorOptions(options)
        )
        .withFaceExpressions()
        .then(result => {
          sendResponse({ result, requestId });
        })
        .catch(err => {
          sendResponse({ error: err.message, requestId });
        });
        return;
      }
      
      // Default error for unsupported methods
      sendResponse({ error: `Unsupported method: ${method}`, requestId });
    } catch (err) {
      sendResponse({ error: err.message, requestId });
    }
  };

  // Helper to send responses back
  function sendResponse(data) {
    channel.postMessage({
      type: 'RESPONSE',
      data
    });
  }
}