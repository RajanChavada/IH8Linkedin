const startBtn = document.getElementById('start');
const videoEl = document.getElementById('video');
const logEl = document.getElementById('log');
const statusText = document.getElementById('status-text');
const emotionDisplay = document.getElementById('emotion-display');


// Brainrot TikTok links to unleash chaos
const brainrotLinks = [
  'https://www.tiktok.com/@masterclip08/video/7552400264179895583?lang=en&q=6%207&t=1760364887865',
  'https://www.tiktok.com/search?q=ohio%20sigma%20skibidi&t=1760364887865',
  'https://www.tiktok.com/search?q=brainrot%20compilation&t=1760364887865',
  'https://www.tiktok.com/search?q=skibidi%20toilet&t=1760364887865',
  'https://www.tiktok.com/search?q=sigma%20male%20grindset&t=1760364887865',
  'https://www.tiktok.com/search?q=ohio%20meme&t=1760364887865'
];

const getRandomBrainrotLink = () => brainrotLinks[Math.floor(Math.random() * brainrotLinks.length)];


// Configuration for emotion detection
const config = {
  targetEmotion: 'surprised',  // Changed from 'sad' to 'surprised'
  threshold: 0.6,              // Lowered from 0.8 to 0.6 - surprised is easier to detect
  minDuration: 3,              // How many seconds the emotion must persist initially
  actionType: 'notification'   // Type of action to perform
};

// Track persistent emotion
let emotionCounter = 0;
let detectionActive = false;
let detectionInterval = null;
let triggeredOnce = false;

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
        
        // Show all emotions in log for debugging
        logEl.innerHTML = Object.entries(emotions)
          .map(([emotion, score]) => `${emotion}: ${(score * 100).toFixed(1)}%`)
          .join('<br>');
        
        // Style based on emotion
        const emotionColors = {
          happy: '#10b981',
          sad: '#3b82f6',
          angry: '#ef4444',
          disgusted: '#8b5cf6',
          surprised: '#f59e0b',  // Highlighted for visibility
          fearful: '#6366f1',
          neutral: '#6b7280'
        };
        
        emotionDisplay.style.background = `rgba(0,0,0,0.15)`;
        emotionDisplay.style.borderLeft = `4px solid ${emotionColors[strongestEmotion[0]] || '#6b7280'}`;
        
        // Check if target emotion (now surprised)
        const targetScore = emotions[config.targetEmotion] || 0;
        const requiredDuration = triggeredOnce ? 1 : config.minDuration;

        // Check if target emotion is strong enough
        if (targetScore >= config.threshold) {
          emotionCounter++;

          // Show progress towards action
          statusText.textContent = `Surprised: ${emotionCounter}/${requiredDuration}`;

          // If emotion has persisted long enough, trigger action
          if (emotionCounter >= requiredDuration) {
            console.log("Surprised expression detected! Triggering brainrot!");

            // Visual feedback
            emotionDisplay.textContent = `Surprised detected! Summoning brainrot...`;
            emotionDisplay.style.background = `rgba(245, 158, 11, 0.2)`;  // Amber color for surprised
            emotionDisplay.style.borderLeft = `4px solid #f59e0b`;

            chrome.runtime.sendMessage({
              type: 'open-brainrot-window',
              url: getRandomBrainrotLink()
            });

            triggeredOnce = true;
            emotionCounter = 0;
          }
        } else {
          // Reset counter if emotion not detected
          emotionCounter = 0;
          statusText.textContent = "Active";
        }
      }
    } catch (error) {
      console.error("Detection error:", error);
      statusText.textContent = "Error";
    }
  }, 500);
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
  triggeredOnce = false;
  emotionCounter = 0;
  
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
  statusText.textContent = "Brainrot ready";
});

