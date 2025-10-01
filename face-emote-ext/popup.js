const startBtn = document.getElementById('start');
const videoEl = document.getElementById('video');
const logEl = document.getElementById('log');
const statusText = document.getElementById('status-text');
const emotionDisplay = document.getElementById('emotion-display');


// Configuration for emotion detection
const config = {
  targetEmotion: 'sad',      // Which emotion to monitor
  threshold: 0.6,            // Threshold (0-1) for emotion detection
  minDuration: 3,            // How many seconds the emotion must persist
  cooldownPeriod: 10,        // Seconds before another action can trigger
  actionType: 'notification' // Type of action to perform
};

// Track persistent emotion
let emotionCounter = 0;
let lastActionTime = 0;
let detectionActive = false;
let detectionInterval = null;

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoEl.srcObject = stream;
    return true;
  } catch (err) {
    console.error("Camera error:", err);
    statusText.textContent = "Camera error";
    return false;
  }
}

async function loadModels() {
  try {
    statusText.textContent = "Loading models...";
    // Use the GitHub CDN instead of local files
    await faceapi.nets.tinyFaceDetector.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights');
    await faceapi.nets.faceExpressionNet.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights');
    statusText.textContent = "Models loaded";
    return true;
  } catch (error) {
    console.error("Error loading models from CDN:", error);
    statusText.textContent = "Model error";
    return false;
  }
}

async function startDetection() {
  if (detectionActive) {
    stopDetection();
    return;
  }
  
  // Update button state
  startBtn.innerHTML = '<i class="fas fa-stop-circle"></i> Stop Detection';
  detectionActive = true;
  
  // Start camera and load models
  const cameraReady = await startCamera();
  if (!cameraReady) return;
  
  const modelsReady = await loadModels();
  if (!modelsReady) return;
  
  // Show emotion display
  emotionDisplay.style.display = 'block';
  statusText.textContent = "Active";
  
  // Start detection loop
  detectionInterval = setInterval(async () => {
    try {
      const result = await faceapi
        .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
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
          
          // If emotion has persisted long enough, trigger action
          if (emotionCounter >= config.minDuration) {
            console.log("Triggering action!");
            
            // Visual feedback
            emotionDisplay.textContent = `${config.targetEmotion} detected! Taking action...`;
            emotionDisplay.style.background = `rgba(16, 185, 129, 0.2)`;
            emotionDisplay.style.borderLeft = `4px solid #10b981`;
            
            // For demonstration, let's directly open a tab
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
  
  // Update UI
  startBtn.innerHTML = '<i class="fas fa-play-circle"></i> Start Detection';
  statusText.textContent = "Ready";
  emotionDisplay.style.display = 'none';
  detectionActive = false;
  
  // Stop camera
  if (videoEl.srcObject) {
    const tracks = videoEl.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    videoEl.srcObject = null;
  }
}

// Event listeners
startBtn.addEventListener('click', startDetection);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  statusText.textContent = "Ready";
});

