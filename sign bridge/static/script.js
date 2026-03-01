const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusOverlay = document.getElementById('status-overlay');
const gestureText = document.getElementById('gesture-text');
const speakBtn = document.getElementById('speak-btn');
const modeToggle = document.getElementById('mode-toggle');
const videoContainer = document.querySelector('.video-container');

canvasElement.width = 640;
canvasElement.height = 480;

let receiverEmail = "{{ user.receiver_email }}";
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

    camera.start();
    statusOverlay.innerText = "Model Loaded - Show Hand";
}

function initAudioContext() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
}

modeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        modeToggle.textContent = '🌙';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        modeToggle.textContent = '☀️';
    }
});

function playEmergencyBeep() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'square';
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.3);
    setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.frequency.value = 800;
        osc2.type = 'square';
        gain2.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc2.start(audioCtx.currentTime);
        osc2.stop(audioCtx.currentTime + 0.3);
    }, 400);
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
    })
    .catch(err => {
        statusOverlay.innerText = "❌ SERVER ERROR";
    });
}

function activateEmergencyMode() {
    isEmergency = true;
    videoContainer.style.background = 'linear-gradient(145deg, #ff0000, #cc0000)';
    statusOverlay.style.background = 'rgba(255, 0, 0, 0.9)';
    statusOverlay.innerText = '🚨 SENDING EMERGENCY 🚨';
    statusOverlay.style.color = '#fff';
    playEmergencyBeep();
    sendEmergencyEmail();
    setTimeout(() => {
        isEmergency = false;
        videoContainer.style.background = '';
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
        const lineColor = isDarkMode ? '#00d2ff' : '#0099cc';
        const dotColor = isDarkMode ? '#ff0000' : '#cc0000';
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: lineColor, lineWidth: 2});
        drawLandmarks(canvasCtx, landmarks, {color: dotColor, lineWidth: 1, radius: 3});
        const gesture = identifyGesture(landmarks);
        updateUI(gesture);
    } else {
        statusOverlay.innerText = "No hand detected";
        gestureText.innerText = "Waiting...";
        speakBtn.disabled = true;
    }
}

function identifyGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const indexPIP = landmarks[6];
    const middlePIP = landmarks[10];
    const ringPIP = landmarks[14];
    const pinkyPIP = landmarks[18];
    const thumbIP = landmarks[3];
    const isFingerUp = (tip, pip) => tip.y < pip.y;
    const indexUp = isFingerUp(indexTip, indexPIP);
    const middleUp = isFingerUp(middleTip, middlePIP);
    const ringUp = isFingerUp(ringTip, ringPIP);
    const pinkyUp = isFingerUp(pinkyTip, pinkyPIP);
    const thumbUp = (thumbTip.y < thumbIP.y);

    if (indexUp && middleUp && ringUp && pinkyUp && thumbUp) return "