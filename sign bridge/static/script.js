const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusOverlay = document.getElementById('status-overlay');
const gestureText = document.getElementById('gesture-text');
const speakBtn = document.getElementById('speak-btn');
const modeToggle = document.getElementById('mode-toggle');
const videoContainer = document.querySelector('.video-container');

// Help Modal Elements
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeHelpBtn = document.getElementById('close-help-btn');

canvasElement.width = 640;
canvasElement.height = 480;

let receiverEmail = "{{ user.receiver_email }}";
let lastSpokenGesture = "";
let isDarkMode = true;
let isEmergency = false;
let hands, camera;

// --- INITIALIZATION ---
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
        .then(() => {
            statusOverlay.innerText = "Camera Active - Show Hand";
        })
        .catch((err) => {
            statusOverlay.innerText = "Camera Error: " + err;
            console.error(err);
        });
}

// --- UI CONTROLS ---
modeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.body.style.background = isDarkMode 
        ? "linear-gradient(135deg, #0f0f1a 0%, #1a1a3a 100%)" 
        : "#f0f2f5";
    modeToggle.textContent = isDarkMode ? '🌙' : '☀️';
});

// Modal Logic
helpBtn.onclick = () => helpModal.style.display = 'flex';
closeHelpBtn.onclick = () => helpModal.style.display = 'none';
window.onclick = (event) => {
    if (event.target == helpModal) helpModal.style.display = 'none';
};

function playEmergencyBeep() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'square';
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
}

function sendEmergencyEmail() {
    fetch('/send-emergency', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: receiverEmail})
    })
    .then(res => res.json())
    .then(data => {
        statusOverlay.innerText = data.success ? "📧 EMAIL SENT!" : "❌ EMAIL FAILED";
    });
}

function activateEmergencyMode() {
    if (isEmergency) return;
    isEmergency = true;
    statusOverlay.innerText = '🚨 EMERGENCY ALERT 🚨';
    playEmergencyBeep();
    sendEmergencyEmail();
    setTimeout(() => { isEmergency = false; }, 5000);
}

// --- COMPUTER VISION LOGIC ---
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00d2ff', lineWidth: 2});
        drawLandmarks(canvasCtx, landmarks, {color: '#ff0000', lineWidth: 1, radius: 3});
        
        const gesture = identifyGesture(landmarks);
        updateUI(gesture);
    } else {
        gestureText.innerText = "Waiting...";
    }
    canvasCtx.restore();
}

function identifyGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const indexPIP = landmarks[6];

    const indexUp = indexTip.y < indexPIP.y;
    const allFingersDown = indexTip.y > landmarks[5].y && pinkyTip.y > landmarks[17].y;

    // Emergency Trigger: Fist (matching your Help Modal Guide)
    if (allFingersDown) {
        activateEmergencyMode();
        return "EMERGENCY";
    }
    
    if (indexUp && middleTip.y < landmarks[10].y && ringTip.y > landmarks[14].y) return "PEACE";
    if (indexUp && middleTip.y > landmarks[10].y) return "POINTING";
    
    return "HAND DETECTED";
}

function updateUI(gesture) {
    gestureText.innerText = gesture;
    speakBtn.disabled = false;
    if (gesture !== lastSpokenGesture && gesture !== "Waiting...") {
        const utterance = new SpeechSynthesisUtterance(gesture);
        window.speechSynthesis.speak(utterance);
        lastSpokenGesture = gesture;
    }
}

// Initialize App
window.onload = initApp;