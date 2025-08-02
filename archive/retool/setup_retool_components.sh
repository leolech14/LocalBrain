#!/bin/bash

# LocalBrain Retool Component Setup Script

echo "🧠 LocalBrain Retool Component Setup"
echo "===================================="

# Check if API token is provided
if [ -z "$1" ]; then
    echo "❌ Error: API token required"
    echo "Usage: ./setup_retool_components.sh YOUR_API_TOKEN"
    echo ""
    echo "To get your API token:"
    echo "1. Go to https://leonardolech1.retool.com"
    echo "2. Navigate to Settings → API"
    echo "3. Generate a new token with 'Custom Component Library' permissions"
    exit 1
fi

# Set the API token
export RETOOL_API_TOKEN="$1"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Run the component creation script
echo "🚀 Creating custom components..."
node create_retool_components.js

echo ""
echo "📝 Manual steps to complete the setup:"
echo "1. Open your Retool app: https://leonardolech1.retool.com/editor/cb112456-6e75-11f0-b62c-731c2657e74d/LocalBrain/page1"
echo ""
echo "2. Add the custom components to your app:"
echo "   - In the left sidebar, find 'Custom Components'"
echo "   - Drag 'LocalBrainChat' to your canvas"
echo "   - Drag 'LocalBrainTerminal' to your canvas"
echo "   - Drag 'LocalBrainFileExplorer' to your canvas"
echo ""
echo "3. Configure each component:"
echo ""
echo "   LocalBrainChat:"
echo "   - messages: {{ chatHistory.data }}"
echo "   - onSendMessage: {{ sendMessage.trigger() }}"
echo "   - isListening: {{ voiceActive.value }}"
echo ""
echo "   LocalBrainTerminal:"
echo "   - history: {{ terminalHistory.data }}"
echo "   - onExecuteCommand: {{ executeCommand.trigger() }}"
echo ""
echo "   LocalBrainFileExplorer:"
echo "   - files: {{ fileTree.data }}"
echo "   - onFileSelect: {{ selectFile.trigger() }}"
echo "   - selectedFile: {{ selectedFile.value }}"
echo ""
echo "4. Create the necessary queries:"
echo "   - chatHistory: Query to fetch chat messages"
echo "   - sendMessage: API call to OpenAI or your LLM"
echo "   - executeCommand: Custom API to handle commands"
echo "   - fileTree: Query to get file structure"
echo ""
echo "✅ Setup script complete!"