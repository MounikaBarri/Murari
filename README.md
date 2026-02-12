# Gemini Chat Application

A simple, elegant chat interface powered by Google's Gemini API, built with Flask and Vanilla HTML/CSS/JS.

## Features

-   dark-themed, modern UI
-   Real-time chat with Gemini
-   Markdown support (basic)
-   Responsive design

## Prerequisites

-   Python 3.7+
-   A Google Cloud Project with the Gemini API enabled
-   An API Key for Gemini

## Installation

1.  **Clone/Navigate to the directory:**
    ```bash
    cd /Users/pavan/Documents/friends/abhi/murari
    ```

2.  **Create a virtual environment (optional but recommended):**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

## Usage

1.  **Set your Gemini API Key:**
    
    You can set it as an environment variable:
    ```bash
    export GEMINI_API_KEY="your_api_key_here"
    ```
    
    Or create a `.env` file in the project root:
    ```env
    GEMINI_API_KEY=your_api_key_here
    ```

2.  **Run the application:**
    ```bash
    python app.py
    ```

3.  **Open in Browser:**
    Go to `http://127.0.0.1:5000` to start chatting!

## Customization

-   **Model**: You can change the model in `app.py` (default: `gemini-1.5-flash`).
-   **Styling**: Modify `static/css/style.css`.
