document.addEventListener('DOMContentLoaded', () => {

    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('mic-btn');
    const emotionOutput = document.getElementById('emotionOutput');

    const cameraBtn = document.getElementById("camera-btn");
    const video = document.getElementById("cameraPreview");
    const canvas = document.getElementById("captureCanvas");

    const speakingIndicator = document.getElementById('speaking-indicator');

    let recognition;
    let isRecording = false;
    let currentAudio = null;
    let cameraActive = false;

    /* =========================================
       🎤 SPEECH RECOGNITION
    ========================================= */

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'te-IN';

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('recording');
        };

        recognition.onend = () => {
            isRecording = false;
            micBtn.classList.remove('recording');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            sendMessage();
        };

        recognition.onerror = () => {
            isRecording = false;
            micBtn.classList.remove('recording');
        };

    } else {
        micBtn.style.display = 'none';
    }

    window.toggleRecording = () => {
        if (!recognition) return;

        if (isRecording) {
            recognition.stop();
        } else {
            stopCurrentAudio();
            recognition.start();
        }
    };

    /* =========================================
       📹 CAMERA + EMOTION DETECTION
    ========================================= */

    cameraBtn.addEventListener("click", async () => {

        if (cameraActive) return;
        cameraActive = true;

        try {

            const stream = await navigator.mediaDevices.getUserMedia({ video: true });

            video.srcObject = stream;
            video.style.display = "block";

            emotionOutput && (emotionOutput.innerText = "కెమెరా ప్రారంభమైంది...");

            // Wait until video metadata is ready
            await new Promise(resolve => {
                video.onloadedmetadata = () => resolve();
            });

            // Small delay for stable frame
            await new Promise(resolve => setTimeout(resolve, 1500));

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = canvas.toDataURL("image/jpeg");

            stream.getTracks().forEach(track => track.stop());
            video.style.display = "none";

            emotionOutput && (emotionOutput.innerText = "భావం గుర్తిస్తున్నాను...");

            const response = await fetch("/detect_emotion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: imageData })
            });

            const data = await response.json();

            if (!response.ok) {
                emotionOutput && (emotionOutput.innerText = "❌ లోపం జరిగింది");
                cameraActive = false;
                return;
            }

            emotionOutput && (emotionOutput.innerText = "భావం: " + data.emotion);

            if (data.emotion !== "ముఖం కనిపించలేదు") {

                let emotionMessage = "";

                switch (data.emotion) {
                    case "బాధ":
                        emotionMessage = "నాకు బాధగా ఉంది";
                        break;
                    case "కోపం":
                        emotionMessage = "నాకు కోపంగా ఉంది";
                        break;
                    case "ఆనందం":
                        emotionMessage = "నేను చాలా సంతోషంగా ఉన్నాను";
                        break;
                    default:
                        emotionMessage = "నేను సాధారణంగా ఉన్నాను";
                }

                userInput.value = emotionMessage;
                sendMessage();
            }

        } catch (error) {
            emotionOutput && (emotionOutput.innerText = "కెమెరా అనుమతి ఇవ్వండి");
            console.error(error);
        }

        cameraActive = false;
    });

    /* =========================================
       📤 SEND MESSAGE
    ========================================= */

    window.sendMessage = async () => {

        stopCurrentAudio();

        const message = userInput.value.trim();
        if (!message) return;

        addMessage('user', message);

        userInput.value = '';
        userInput.disabled = true;
        sendBtn.disabled = true;

        const loadingId = addLoadingIndicator();

        try {

            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            const data = await response.json();

            removeLoadingIndicator(loadingId);

            if (response.ok) {
                addMessage('ai', data.response);
                speakWithGemini(data.response);
            } else {
                addMessage('system', '❌ ' + (data.error || 'ఏదో తప్పు జరిగింది'));
            }

        } catch (error) {
            removeLoadingIndicator(loadingId);
            addMessage('system', '🌐 Network Error');
        }

        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    };

    /* =========================================
       🔊 GEMINI TTS
    ========================================= */

    async function speakWithGemini(text) {

        try {

            speakingIndicator?.classList.add('active');

            const response = await fetch('/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            const data = await response.json();

            if (response.ok && data.audio) {

                const audioBlob = new Blob(
                    [Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))],
                    { type: 'audio/wav' }
                );

                const audioUrl = URL.createObjectURL(audioBlob);

                currentAudio = new Audio(audioUrl);

                currentAudio.onended = () => {
                    speakingIndicator?.classList.remove('active');
                    URL.revokeObjectURL(audioUrl);
                };

                await currentAudio.play();
            }

        } catch (error) {
            console.error(error);
            speakingIndicator?.classList.remove('active');
        }
    }

    function stopCurrentAudio() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }
        speakingIndicator?.classList.remove('active');
    }

    /* =========================================
       💬 UI HELPERS
    ========================================= */

    function addMessage(role, text) {

        const div = document.createElement('div');
        div.classList.add('message');

        if (role === 'user') {
            div.classList.add('user-msg');
        } else if (role === 'ai') {
            div.classList.add('ai-msg');
        } else {
            div.classList.add('system-message');
        }

        div.textContent = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addLoadingIndicator() {
        const id = "loading-" + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.classList.add('message', 'ai-msg');
        div.textContent = "⏳ కథ తయారు చేస్తున్నాను...";
        chatMessages.appendChild(div);
        return id;
    }

    function removeLoadingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

});