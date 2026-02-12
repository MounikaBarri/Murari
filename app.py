from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Basic user input logic for API key if missing
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("Warning: GEMINI_API_KEY is not set in environment variables.")

# Create the model configuration
# Using a standard configuration; can be tuned further
generation_config = {
    "temperature": 0.9,
    "top_p": 1,
    "top_k": 1,
    "max_output_tokens": 2048,
}

safety_settings = [
    {
        "category": "HARM_CATEGORY_HARASSMENT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_HATE_SPEECH",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
]

try:
    model = genai.GenerativeModel(model_name="gemini-2.5-flash",
                                  generation_config=generation_config,
                                  safety_settings=safety_settings)
except Exception as e:
    print(f"Error initializing model: {e}")
    model = None

chat_history = []  # In-memory simple history for demo purpose (per session would be better generally but keeping it simple)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    global chat_history
    user_input = request.json.get('message')
    
    if not user_input:
        return jsonify({'error': 'No message provided'}), 400

    if not model:
        return jsonify({'error': 'Model not initialized. Check server logs for API key status.'}), 500

    try:
        # Start chat session or continue existing chat
        # For simplicity in this demo, we'll use start_chat with history
        chat_session = model.start_chat(history=chat_history)
        response = chat_session.send_message(user_input)
        
        # Update history
        chat_history.append({'role': 'user', 'parts': [user_input]})
        chat_history.append({'role': 'model', 'parts': [response.text]})
        
        return jsonify({'response': response.text})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/clear_history', methods=['POST'])
def clear_history():
    global chat_history
    chat_history = []
    return jsonify({'status': 'History cleared'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
