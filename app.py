from flask import Flask, render_template, request, jsonify, send_file
from google import genai
from google.genai import types
import os
import io
import wave
import base64
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY is not set in environment variables.")

# Initialize the new genai Client
client = genai.Client(api_key=GEMINI_API_KEY)

# Chat model name
CHAT_MODEL = "gemini-2.5-flash"
# TTS model name
TTS_MODEL = "gemini-2.5-flash-preview-tts"
# Default TTS voice
TTS_VOICE = "Kore"

chat_history = []


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/chat', methods=['POST'])
def chat():
    global chat_history
    user_input = request.json.get('message')

    if not user_input:
        return jsonify({'error': 'No message provided'}), 400

    try:
        # Build the contents list from history + new message
        contents = []
        for msg in chat_history:
            contents.append(
                types.Content(
                    role=msg['role'],
                    parts=[types.Part.from_text(text=msg['text'])]
                )
            )
        contents.append(
            types.Content(
                role='user',
                parts=[types.Part.from_text(text=user_input)]
            )
        )

        response = client.models.generate_content(
            model=CHAT_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0.9,
                max_output_tokens=2048,
            )
        )

        ai_text = response.text

        # Update history
        chat_history.append({'role': 'user', 'text': user_input})
        chat_history.append({'role': 'model', 'text': ai_text})

        return jsonify({'response': ai_text})

    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/tts', methods=['POST'])
def tts():
    """Generate speech audio from text using Gemini TTS."""
    text = request.json.get('text')
    voice = request.json.get('voice', TTS_VOICE)

    if not text:
        return jsonify({'error': 'No text provided'}), 400

    try:
        # Use the Gemini TTS model
        response = client.models.generate_content(
            model=TTS_MODEL,
            contents=f"Say: {text}",
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice,
                        )
                    ),
                ),
            )
        )

        # Extract raw PCM audio data
        audio_data = response.candidates[0].content.parts[0].inline_data.data

        # Convert PCM to WAV in memory
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(24000)
            wf.writeframes(audio_data)

        wav_buffer.seek(0)
        audio_base64 = base64.b64encode(wav_buffer.read()).decode('utf-8')

        return jsonify({'audio': audio_base64})

    except Exception as e:
        print(f"TTS error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/clear_history', methods=['POST'])
def clear_history():
    global chat_history
    chat_history = []
    return jsonify({'status': 'History cleared'})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
