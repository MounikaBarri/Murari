from flask import Flask, render_template, request, jsonify
from google import genai
from google.genai import types
import os
import io
import wave
import base64
import re
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY is not set in environment variables.")

# Initialize the genai Client
client = genai.Client(api_key=GEMINI_API_KEY)

# Models
CHAT_MODEL = "gemini-2.5-flash"
TTS_MODEL = "gemini-2.5-flash-preview-tts"
TTS_VOICE = "Kore"  # A warm, friendly voice

# ============================================================
# RAG: Load Mahabharata.txt and chunk it
# ============================================================
MAHABHARATA_CHUNKS = []

def load_mahabharata():
    """Load Mahabharata.txt and split into chapter-based chunks."""
    global MAHABHARATA_CHUNKS
    filepath = os.path.join(os.path.dirname(__file__), "Mahabharata.txt")
    if not os.path.exists(filepath):
        print("WARNING: Mahabharata.txt not found!")
        return

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Split by chapters (each chapter starts with "Chapter" followed by a number/word)
    # We'll use a simpler approach: split by double newlines into paragraphs,
    # then group them into chunks of ~2000 chars
    paragraphs = re.split(r'\n\s*\n', content)

    chunk = ""
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(chunk) + len(para) > 2000:
            if chunk:
                MAHABHARATA_CHUNKS.append(chunk)
            chunk = para
        else:
            chunk += "\n\n" + para if chunk else para

    if chunk:
        MAHABHARATA_CHUNKS.append(chunk)

    print(f"Loaded {len(MAHABHARATA_CHUNKS)} chunks from Mahabharata.txt")


def search_chunks(query, top_k=3):
    """Simple keyword-based search to find relevant chunks."""
    query_words = set(query.lower().split())
    scored = []
    for i, chunk in enumerate(MAHABHARATA_CHUNKS):
        chunk_lower = chunk.lower()
        score = sum(1 for word in query_words if word in chunk_lower)
        # Bonus for exact phrase matches
        if query.lower() in chunk_lower:
            score += 10
        scored.append((score, i, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    # Return top_k chunks with score > 0
    results = [chunk for score, i, chunk in scored[:top_k] if score > 0]

    # If no keyword match, return a random selection of interesting chunks
    if not results:
        import random
        indices = random.sample(range(len(MAHABHARATA_CHUNKS)), min(top_k, len(MAHABHARATA_CHUNKS)))
        results = [MAHABHARATA_CHUNKS[i] for i in indices]

    return results


# Load on startup
load_mahabharata()

# ============================================================
# System prompt for Telugu children's storyteller
# ============================================================
SYSTEM_PROMPT = """నువ్వు "మురారి" అనే పేరు గల ఒక తెలుగు AI స్నేహితుడివి. నువ్వు 3-10 ఏళ్ళ చిన్నపిల్లలతో మాట్లాడుతున్నావు. నువ్వు వాళ్ళకి నేస్తం లాంటి వాడివి — ప్రేమగా, ఓపికగా, ఆప్యాయంగా ఉంటావు.

🌟 భాష నియమం (అతి ముఖ్యం):
- నువ్వు ఎప్పుడూ తెలుగులో మాత్రమే మాట్లాడాలి.
- ఇంగ్లీషు, హిందీ లేదా ఇతర భాషలు వాడకూడదు. ఇంగ్లీషులో ఎవరైనా అడిగినా తెలుగులోనే సమాధానం చెప్పు.
- సులభమైన, పిల్లలకు అర్థమయ్యే తెలుగు వాడు. కష్టమైన గ్రాంథిక పదాలు వాడకు.

🎭 పిల్లల మనసు (Emotion) గుర్తించడం:
నువ్వు పిల్లల message చదివి వాళ్ళ భావాన్ని (emotion) గుర్తించాలి. దాని ఆధారంగా ఎలా respond చేయాలో:

1. 😊 సంతోషంగా/ఆటపాటలు: చలాకీగా, ఉత్సాహంగా మాట్లాడు. జోకులు చెప్పు. వాళ్ళ సంతోషంలో భాగం పంచుకో.
2. 😢 బాధగా/ఏడుస్తున్నట్టు: ఓదార్పు మాటలు చెప్పు. "అయ్యో బంగారూ, బాధపడకు" అని ప్రేమగా చెప్పు. వాళ్ళని ఓదార్చిన తర్వాత, వాళ్ళ మనసు మళ్ళించడానికి ఒక చిన్న ధైర్యం గురించి కథ చెప్పు.
3. 😨 భయంగా: "భయం వద్దు నాన్నా, నేను ఉన్నానుగా" అని ధైర్యం చెప్పు. భయం తీర్చే మాటలు చెప్పు. అర్జునుడు లేదా భీముడి ధైర్యం గురించి చెప్పు.
4. 😴 బోరు/విసుగు: ఇంట్రస్టింగ్ గా ఒక కథ మొదలు పెట్టు. "ఒక అద్భుతమైన సంగతి చెప్తా విను!" అని ఆసక్తి కలిగించు.
5. 🤔 ప్రశ్న/ఆసక్తి: వాళ్ళ ప్రశ్నకు సరళంగా సమాధానం చెప్పు. మహాభారతం context నుండి సంబంధిత విషయాలు చెప్పు.
6. 💬 కబుర్లు చెప్పాలని: వాళ్ళతో స్నేహంగా కబుర్లు చెప్పు. వాళ్ళ ఇష్టాలు, అనిష్టాలు, రోజు ఎలా గడిచింది అని అడుగు. నిజమైన తాతయ్యలా caring గా ఉండు.

📖 కథ చెప్పే సమయం:
- పిల్లలు "కథ చెప్పు", "story", "కథ", "చెప్పు తాతయ్య" అని అడిగినప్పుడు మాత్రమే కథ చెప్పు.
- కథ 4-5 వాక్యాలలో చాలా చిన్నగా ఉండాలి.
- కథ చివరలో ఒక వాక్యంలో నీతి చెప్పు.
- కింద ఇచ్చిన మహాభారతం సందర్భం (context) నుండి కథలు తీసుకో. context లో ఉన్న పాత్రలు, సంఘటనలు వాడు.
- ఒక్కొక్క సమయంలో ఒక్క చిన్న కథ మాత్రమే చెప్పు.

💝 ఎలా పిలవాలి:
- "బంగారు", "చిన్నారి", "నాన్నా", "తల్లీ", "రాజా", "రాణీ" అని ప్రేమగా పిలువు.
- వాళ్ళ పేరు చెప్తే, ఆ పేరుతో పిలువు.

⚡ ముఖ్యమైన గమనిక:
- ఎప్పుడూ VERY SHORT responses ఇవ్వు (2-5 వాక్యాలు). పిల్లలకు పెద్ద సమాధానాలు బోరు.
- ప్రతి message లో ఒక emoji వాడు.
- సహజంగా, మామూలుగా మాట్లాడు. రోబోట్ లా కాకుండా నిజమైన తాతయ్య లా ఉండు.
"""

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
        # RAG: Find relevant Mahabharata context
        relevant_chunks = search_chunks(user_input, top_k=3)
        context_text = "\n\n---\n\n".join(relevant_chunks)

        # Build the full prompt with system instructions + context
        system_with_context = SYSTEM_PROMPT + f"\n\nమహాభారతం సందర్భం (context):\n{context_text}"

        # Build conversation contents
        contents = []

        # Add chat history
        for msg in chat_history:
            contents.append(
                types.Content(
                    role=msg['role'],
                    parts=[types.Part.from_text(text=msg['text'])]
                )
            )

        # Add current user message
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
                max_output_tokens=1024,
                system_instruction=system_with_context,
            )
        )

        ai_text = response.text

        # Update history (keep last 10 messages to avoid token overflow)
        chat_history.append({'role': 'user', 'text': user_input})
        chat_history.append({'role': 'model', 'text': ai_text})
        if len(chat_history) > 20:
            chat_history = chat_history[-20:]

        return jsonify({'response': ai_text})

    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/tts', methods=['POST'])
def tts():
    """Generate speech audio from Telugu text using Gemini TTS."""
    text = request.json.get('text')
    voice = request.json.get('voice', TTS_VOICE)

    if not text:
        return jsonify({'error': 'No text provided'}), 400

    try:
        # Use the Gemini TTS model - the model auto-detects Telugu
        tts_prompt = f"Say in a warm, gentle, storytelling tone as if talking to children: {text}"

        response = client.models.generate_content(
            model=TTS_MODEL,
            contents=tts_prompt,
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
