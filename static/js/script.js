document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('mic-btn');

    let recognition;
    let isRecording = false;
    let currentAudio = null; // Track currently playing audio

    // Initialize Speech Recognition (for voice input)
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

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
            // Auto-send after voice input
            sendMessage();
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            isRecording = false;
            micBtn.classList.remove('recording');
        };
    } else {
        micBtn.style.display = 'none';
        console.log('Speech recognition not supported');
    }

    window.toggleRecording = () => {
        if (!recognition) return;
        if (isRecording) {
            recognition.stop();
        } else {
            stopCurrentAudio(); // Stop AI from talking
            recognition.start();
        }
    };

    // Auto-resize textarea
    userInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value === '') {
            this.style.height = 'auto';
        }
    });

    // Send on Enter (Shift+Enter for new line)
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    window.sendMessage = async () => {
        stopCurrentAudio(); // Stop any playing audio

        const message = userInput.value.trim();
        if (!message) return;

        addMessage('user', message);
        userInput.value = '';
        userInput.style.height = 'auto';

        userInput.disabled = true;
        sendBtn.disabled = true;

        const loadingId = addLoadingIndicator();

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message })
            });

            const data = await response.json();
            removeLoadingIndicator(loadingId);

            if (response.ok) {
                addMessage('ai', data.response);
                // Generate and play Gemini TTS audio
                speakWithGemini(data.response);
            } else {
                addMessage('system', 'Error: ' + (data.error || 'Something went wrong'));
            }
        } catch (error) {
            removeLoadingIndicator(loadingId);
            addMessage('system', 'Network Error: ' + error.message);
        } finally {
            userInput.disabled = false;
            sendBtn.disabled = false;
            userInput.focus();
        }
    };

    async function speakWithGemini(text) {
        try {
            // Show a subtle speaking indicator
            const speakingIndicator = document.getElementById('speaking-indicator');
            if (speakingIndicator) speakingIndicator.classList.add('active');

            const response = await fetch('/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });

            const data = await response.json();

            if (response.ok && data.audio) {
                // Decode base64 WAV and play it
                const audioBytes = atob(data.audio);
                const arrayBuffer = new ArrayBuffer(audioBytes.length);
                const view = new Uint8Array(arrayBuffer);
                for (let i = 0; i < audioBytes.length; i++) {
                    view[i] = audioBytes.charCodeAt(i);
                }

                const audioBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);

                currentAudio = new Audio(audioUrl);
                currentAudio.onended = () => {
                    if (speakingIndicator) speakingIndicator.classList.remove('active');
                    URL.revokeObjectURL(audioUrl);
                    currentAudio = null;
                };
                currentAudio.onerror = () => {
                    if (speakingIndicator) speakingIndicator.classList.remove('active');
                    currentAudio = null;
                };
                currentAudio.play();
            } else {
                console.error('TTS error:', data.error);
                if (speakingIndicator) speakingIndicator.classList.remove('active');
            }
        } catch (error) {
            console.error('TTS fetch error:', error);
            const speakingIndicator = document.getElementById('speaking-indicator');
            if (speakingIndicator) speakingIndicator.classList.remove('active');
        }
    }

    function stopCurrentAudio() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }
        const speakingIndicator = document.getElementById('speaking-indicator');
        if (speakingIndicator) speakingIndicator.classList.remove('active');
    }

    window.clearHistory = async () => {
        if (confirm('Are you sure you want to clear the chat history?')) {
            try {
                await fetch('/clear_history', { method: 'POST' });
                chatMessages.innerHTML = '';
                addMessage('system', 'Chat history cleared.');
            } catch (e) {
                console.error(e);
            }
        }
    };

    function addMessage(role, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');

        if (role === 'user') {
            messageDiv.classList.add('user-msg');
            messageDiv.innerHTML = `<p>${formatText(text)}</p>`;
        } else if (role === 'ai') {
            messageDiv.classList.add('ai-msg');
            messageDiv.innerHTML = formatAIResponse(text);
        } else {
            messageDiv.classList.add('system-message');
            messageDiv.textContent = text;
        }

        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function addLoadingIndicator() {
        const id = 'loading-' + Date.now();
        const loadingDiv = document.createElement('div');
        loadingDiv.id = id;
        loadingDiv.classList.add('message', 'ai-msg', 'loading-msg');
        loadingDiv.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Thinking...';
        chatMessages.appendChild(loadingDiv);
        scrollToBottom();
        return id;
    }

    function removeLoadingIndicator(id) {
        const element = document.getElementById(id);
        if (element) element.remove();
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function formatText(text) {
        return text.replace(/\n/g, '<br>');
    }

    function formatAIResponse(text) {
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    }
});
