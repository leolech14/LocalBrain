#!/bin/bash

echo "🧠 Starting LocalBrain Voice Test..."
echo "=================================="
echo ""

# Check for API key
if [ -z "$OPENAI_API_KEY" ]; then
    if [ -f .env ]; then
        export $(cat .env | grep OPENAI_API_KEY | xargs)
    fi
    
    if [ -z "$OPENAI_API_KEY" ]; then
        echo "⚠️  WARNING: OPENAI_API_KEY not set. Voice features using OpenAI will not work."
        echo "   You can still test with local Whisper.cpp and Piper TTS."
        echo ""
    fi
fi

# Make sure we're in the right directory
cd "$(dirname "$0")"

echo "📦 Installing dependencies if needed..."
pnpm install

echo ""
echo "🚀 Starting LocalBrain..."
echo ""
echo "Once the app starts:"
echo "1. Navigate to: http://localhost:3001/#/voice-test"
echo "2. Or use the app menu to go to Voice Test"
echo ""
echo "Voice Test Features:"
echo "- Test STT with OpenAI Whisper or local Whisper.cpp"
echo "- Test TTS with OpenAI or local Piper"
echo "- Test wake word detection"
echo "- Real-time audio level monitoring"
echo "- Transcript display"
echo ""

# Start the application
pnpm --filter=desktop tauri:dev