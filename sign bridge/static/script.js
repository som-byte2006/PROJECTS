const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusOverlay = document.getElementById('status-overlay');
const gestureText = document.getElementById('gesture-text');
const speakBtn = document.getElementById('speak-btn');
const modeToggle = document.getElementById('mode-toggle');
const helpBtn = document.getElementById('help-btn');
const closeHelpBtn = document.getElementById('close-help-btn');
const helpModal = document.getElementById('help-modal');
const videoContainer = document.getElementById('main-container');

// GET RECEIVER EMAIL FROM HTML DATA ATTRIBUTE
let receiverEmail = videoContainer.getAttribute('data-receiver');

canvasElement.width = 640;
canvasElement.height = 480;

let lastSpokenGesture = "";
let isDarkMode = true;
let isEmergency = false;
let hands, camera;

function initApp() {
    hands = new Hands({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    hands.onResults(onResults);

    camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({image: videoElement});
        },
        width: 640,
        height: 480
    });

    camera.start()
        .then(() => { statusOverlay.innerText = "Model Loaded - Show Hand"; })
        .catch((err) => { statusOverlay.innerText = "Camera Error: " + err; });
}

function initAudioContext() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
}

window.addEventListener('load', () => {
    initAudioContext();
    initApp();
});

modeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    modeToggle.textContent = isDarkMode ? '🌙' : '☀️';
});

if (helpBtn) helpBtn.onclick = () => helpModal.style.display = 'flex';
if (closeHelpBtn) closeHelpBtn.onclick = () => helpModal.style.display = 'none';

function playEmergencyBeep() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 800;
        osc.type = 'square';
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    };
    playTone();
    setTimeout(playTone, 400);
}

function sendEmergencyEmail() {
    if (!receiverEmail || receiverEmail === "" || receiverEmail === "None") {
        statusOverlay.innerText = "❌ NO RECEIVER SET";
        return;
    }

    fetch('/send-emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: receiverEmail })
    })
    .then(res => res.json())
    .then(data => {
        statusOverlay.innerText = data.success ? "📧 EMAIL SENT!" : "❌ EMAIL FAILED";
    })
    .catch(() => { statusOverlay.innerText = "❌ SERVER ERROR"; });
}

function activateEmergencyMode() {
    if (isEmergency) return;
    isEmergency = true;
    videoContainer.style.background = 'linear-gradient(145deg, #ff0000, #cc0000)';
    videoContainer.style.boxShadow = '0 0 50px rgba(255, 0, 0, 0.8)';
    statusOverlay.style.background = 'rgba(255, 0, 0, 0.9)';
    statusOverlay.innerText = '🚨 SENDING EMERGENCY 🚨';
    statusOverlay.style.color = '#fff';
    
    playEmergencyBeep();
    sendEmergencyEmail();
    
    setTimeout(() => {
        isEmergency = false;
        videoContainer.style.background = '';
        videoContainer.style.boxShadow = '';
        statusOverlay.style.background = '';
        statusOverlay.innerText = 'Hand Detected';
        statusOverlay.style.color = '';
    }, 4000);
}

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const color = isDarkMode ? '#00d2ff' : '#0099cc';
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: color, lineWidth: 2});
        drawLandmarks(canvasCtx, landmarks, {color: '#ff0000', lineWidth: 1, radius: 3});
        
        const gesture = identifyGesture(landmarks);
        updateUI(gesture);
    } else {
        statusOverlay.innerText = "No hand detected";
        gestureText.innerText = "Waiting...";
        speakBtn.disabled = true;
    }
    canvasCtx.restore();
}

function identifyGesture(landmarks) {
    const thumbTip = landmarks[4], indexTip = landmarks[8], middleTip = landmarks[12];
    const ringTip = landmarks[16], pinkyTip = landmarks[20];
    const indexPIP = landmarks[6], middlePIP = landmarks[10], ringPIP = landmarks[14];
    const pinkyPIP = landmarks[18], thumbIP = landmarks[3];

    const isFingerUp = (tip, pip) => tip.y < pip.y;
    const indexUp = isFingerUp(indexTip, indexPIP);
    const middleUp = isFingerUp(middleTip, middlePIP);
    const ringUp = isFingerUp(ringTip, ringPIP);
    const pinkyUp = isFingerUp(pinkyTip, pinkyPIP);
    const thumbUp = thumbTip.y < thumbIP.y;

    if (indexUp && middleUp && ringUp && pinkyUp && thumbUp) return "STOP";
    if (!indexUp && !middleUp && !ringUp && !pinkyUp) return "EMERGENCY";
    if (indexUp && middleUp && !ringUp && !pinkyUp) return "THANK YOU";
    if (!indexUp && !middleUp && !ringUp && !pinkyUp && thumbUp && thumbTip.x < indexTip.x) return "YES";
    if (indexUp && !middleUp && !ringUp && !pinkyUp) return "YES";
    if (indexUp && !middleUp && !ringUp && pinkyUp && thumbUp) return "HELLO";
    if (indexUp && middleUp && ringUp && !pinkyUp) return "NO";
    if (indexUp && middleUp && ringUp && pinkyUp && !thumbUp) return "FOUR";
    if (indexUp && !middleUp && !ringUp && pinkyUp) return "EIGHT";
    if (!indexUp && !middleUp && !ringUp && pinkyUp) return "SIX";

    return "UNKNOWN";
}

function updateUI(gesture) {
    if (gesture === "EMERGENCY") {
        statusOverlay.innerText = "🚨 EMERGENCY 🚨";
        gestureText.innerText = "EMERGENCY";
        if (!isEmergency) activateEmergencyMode();
        return;
    }
    
    statusOverlay.innerText = "Hand Detected";
    if (gesture !== "UNKNOWN") {
        gestureText.innerText = gesture;
        speakBtn.disabled = false;
        if (gesture !== lastSpokenGesture) {
            lastSpokenGesture = gesture;
            speakText(gesture);
        }
    } else {
        gestureText.innerText = "Adjust Hand";
        speakBtn.disabled = true;
    }
}

function speakText(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
}

speakBtn.addEventListener('click', () => {
    if(gestureText.innerText !== "Waiting...") speakText(gestureText.innerText);
});