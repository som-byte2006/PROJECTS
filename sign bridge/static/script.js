// 1. Setup Elements
const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusOverlay = document.getElementById('status-overlay');
const gestureText = document.getElementById('gesture-text');
const speakBtn = document.getElementById('speak-btn');
const modeToggle = document.getElementById('mode-toggle');

// 2. State Variables
let lastSpokenGesture = "";
let isDarkMode = true;
let isEmergency = false;
let hands, camera;

// 3. Initialize MediaPipe Hands
function initApp() {
    statusOverlay.innerText = "Loading Model...";

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

    // Initialize Camera
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
            console.error("Camera failed:", err);
        });
}

// 4. Processing Results
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Draw the skeleton
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00d2ff', lineWidth: 2});
        drawLandmarks(canvasCtx, landmarks, {color: '#ff0000', lineWidth: 1, radius: 3});
        
        const gesture = identifyGesture(landmarks);
        updateUI(gesture);
    } else {
        gestureText.innerText = "Waiting...";
    }
    canvasCtx.restore();
}

// 5. Gesture Recognition Logic
function identifyGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const pinkyTip = landmarks[20];
    const indexPIP = landmarks[6];

    // Simple vertical check: Is the tip higher (lower Y value) than the joint?
    const indexUp = indexTip.y < indexPIP.y;
    const allFingersDown = indexTip.y > landmarks[5].y && pinkyTip.y > landmarks[17].y;

    if (allFingersDown) {
        if (!isEmergency) activateEmergencyMode();
        return "EMERGENCY";
    }
    
    if (indexUp && middleTip.y < landmarks[10].y) return "PEACE";
    if (indexUp) return "POINTING";
    
    return "HAND DETECTED";
}

// 6. Emergency & UI functions
function activateEmergencyMode() {
    isEmergency = true;
    statusOverlay.innerText = '🚨 SENDING ALERT 🚨';
    // Trigger the backend route we set up earlier
    fetch('/send-emergency', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: "{{ user.receiver_email }}"})
    });
    setTimeout(() => { isEmergency = false; }, 5000);
}

function updateUI(gesture) {
    gestureText.innerText = gesture;
    if (gesture !== lastSpokenGesture && gesture !== "Waiting...") {
        const utterance = new SpeechSynthesisUtterance(gesture);
        window.speechSynthesis.speak(utterance);
        lastSpokenGesture = gesture;
    }
}

// 7. Start the engine when page loads
window.onload = initApp;