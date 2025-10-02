# IH8Linkedin Chrome Extension

**IH8Linkedin** (I Hate LinkedIn—**but I really don’t**) is a playful yet helpful Chrome extension designed to help users combat the negative emotions, FOMO, and unhealthy comparison that can arise when browsing LinkedIn. While I don’t actually hate LinkedIn, I (like many of us) noticed the feeling of jealousy and lack when seeing peers land “cooler” jobs, internships, or achievements. This isn’t good for mental health—because *comparison is the thief of joy*. That’s where IH8Linkedin comes in.

---

## 🚀 Features

- **Automatic Emotion Detection**:  
  As soon as you open LinkedIn, the extension triggers and starts tracking your facial expressions using face-api.js.
- **Real-Time Mood Tracking**:  
  Detects emotions like surprise, sadness, happiness, or frustration via your webcam.
- **Pop-up Mood Alerts & UI**:  
  Includes a beautiful popup with an improved user interface to gently remind you to check in with your feelings—*not* your FOMO.
- **Personal Privacy**:  
  All emotion tracking is done client-side. No data is ever sent or stored externally.

---

## 💡 Motivation

Scrolling through LinkedIn can suck the joy out of your own accomplishments when you begin comparing yourself to others. This extension was built as a reminder and a tool:  
> When you feel FOMO or jealousy, let the app nudge you back to recognizing your own unique journey.

---

## 🏗️ How It Works

1. **Activates on LinkedIn**:  
   Once you visit LinkedIn in your browser, the extension quietly runs in the background.
2. **Facial Expression Tracking**:  
   It loads lightweight face detection and expression models to analyze your emotions.
3. **Gentle Disruption**:  
   If it senses negative emotions, it can display a kind message or take another user-defined action.
4. **Popup**:  
   A custom popup lets you check your mood any time.

---

## 📦 Models & Assets Used

IH8Linkedin leverages open-source models from [`face-api.js`](https://github.com/justadudewhohacks/face-api.js):

- [`face_expression_model-shard1`](https://github.com/RajanChavada/IH8Linkedin/blob/main/face-emote-ext/models/face_expression_model-shard1)
- [`face_expression_model-weights_manifest.json`](https://github.com/RajanChavada/IH8Linkedin/blob/main/face-emote-ext/models/face_expression_model-weights_manifest.json)
- [`tiny_face_detector_model-shard1`](https://github.com/RajanChavada/IH8Linkedin/blob/main/face-emote-ext/models/tiny_face_detector_model-shard1)
- [`tiny_face_detector_model-weights_manifest.json`](https://github.com/RajanChavada/IH8Linkedin/blob/main/face-emote-ext/models/tiny_face_detector_model-weights_manifest.json)

These were placed directly into the code and invoked by the extension for real-time, local face and emotion detection.

---

## 📝 Key Commits

- [Add MoodGuard Chrome extension for emotion detection](https://github.com/RajanChavada/IH8Linkedin/commit/a5bb2adaececc50df687c700acc11060e7d5cbce)
- [Added popup with better UI](https://github.com/RajanChavada/IH8Linkedin/commit/fe10f7f5927f249769ad68005d6e6338083c8544)

---

## 🙏 Credits

- Models and backbone logic from [`face-api.js`](https://github.com/justadudewhohacks/face-api.js)
- UI/UX, integration, and LinkedIn-specific triggers built by **[Rajan Chavada](https://github.com/RajanChavada/IH8Linkedin)**

---

## 📸 Screenshots

*(Add your screenshots here to showcase the extension in action!)*

---

## 🌈 Final Note

**IH8Linkedin** exists to help you stay mindful and present. Whenever comparing yourself online, remember:
> Comparison is the thief of joy—focus on your own growth.

---

**Clone, fork, or contribute on GitHub!**
