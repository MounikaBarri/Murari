#!/bin/bash

# Check if python is installed
if ! command -v python3 &> /dev/null
then
    echo "Python3 could not be found. Please install Python."
    exit
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Check for .env file or environment variable
if [ -z "$GEMINI_API_KEY" ] && [ ! -f ".env" ]; then
    echo "WARNING: GEMINI_API_KEY is not set. Please set it in a .env file or export it."
    echo "Creating a sample .env file..."
    echo "GEMINI_API_KEY=your_api_key_here" > .env
    echo "Please update the .env file with your actual API key."
fi

# Run the app
echo "Starting the application..."
python app.py
