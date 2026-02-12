document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');

    const micBtn = document.getElementById('mic-btn');
    let recognition;
    let isRecording = false;

    // Initialize Speech Recognition
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
            // Auto-send after voice input for natural flow
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
            window.speechSynthesis.cancel(); // Stop AI from talking
            recognition.start();
        }
    };

    // Auto-resize textarea
    userInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value === '') {
            this.style.height = 'auto'; // Reset
        }
    });

    // Send on Enter (but Shift+Enter for new line)
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    window.sendMessage = async () => {
        // Stop any current speech
        window.speechSynthesis.cancel();

        const message = userInput.value.trim();
        if (!message) return;

        // Add User Message immediately
        addMessage('user', message);
        userInput.value = '';
        userInput.style.height = 'auto'; // Reset height

        // Disable input while waiting
        userInput.disabled = true;
        sendBtn.disabled = true;

        // Show loading indicator
        const loadingId = addLoadingIndicator();

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message })
            });

            const data = await response.json();

            // Remove loading indicator
            removeLoadingIndicator(loadingId);

            if (response.ok) {
                addMessage('ai', data.response);
                speakText(data.response); // Speak the response
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

    function speakText(text) {
        if (!('speechSynthesis' in window)) return;

        // Basic cleanup of markdown for speech
        const cleanText = text.replace(/[*#`]/g, '');

        const utterance = new SpeechSynthesisUtterance(cleanText);
        // Optional: Select voice, rate, pitch
        // const voices = window.speechSynthesis.getVoices();
        // utterance.voice = voices.find(voice => voice.name.includes('Google US English')); 

        window.speechSynthesis.speak(utterance);
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
    }

    function addMessage(role, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');

        if (role === 'user') {
            messageDiv.classList.add('user-msg');
            messageDiv.innerHTML = `<p>${formatText(text)}</p>`;
        } else if (role === 'ai') {
            messageDiv.classList.add('ai-msg');
            // Check for code blocks or simple markdown (basic implementation)
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
        if (element) {
            element.remove();
        }
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Simple helper to format text (convert newlines to <br>)
    function formatText(text) {
        return text.replace(/\n/g, '<br>');
    }

    // Basic Markdown parser for AI response
    function formatAIResponse(text) {
        // Convert bold
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Convert italics
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Convert code blocks (simplified)
        formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        // Convert inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Convert newlines
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }
});
