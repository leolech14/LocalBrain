# LocalBrain Retool Import Instructions

## Quick Start

1. **Import the Components**
   - Open Retool
   - Create a new app called "LocalBrain"
   - Go to the app settings and import from JSON
   - Upload `retool_localbrain_components.json`

2. **Configure Resources**
   - Add a REST API resource:
     - Name: `localbrainAPI`
     - Base URL: `http://localhost:3001/api`
   - Add a WebSocket resource:
     - Name: `localbrainWS`  
     - URL: `ws://localhost:3001/ws`

3. **Set Environment Variables**
   - Add to Retool config vars:
     - `OPENAI_API_KEY`: Your OpenAI key (if using)
     - `LOCALBRAIN_API_URL`: http://localhost:3001

4. **Start the API Server**
   ```bash
   npm install
   npm start
   ```

5. **Launch LocalBrain**
   - Start your LocalBrain Tauri app
   - Open the Retool app
   - Everything should connect automatically!

## Features Available

- ✅ Chat with AI (GPT-4 or Ollama)
- ✅ Multi-tab terminal
- ✅ File explorer with editor
- ✅ Voice control (Hey Brain)
- ✅ Context manager
- ✅ Agent visualization
- ✅ Offline mode
- ✅ Real-time sync

## Customization

- Modify colors in the component styles
- Add custom queries for your workflows
- Extend the API server for additional features
- Create custom components for specialized views

## Troubleshooting

- **Connection refused**: Make sure LocalBrain is running
- **CORS errors**: Check API server CORS settings
- **WebSocket issues**: Verify firewall settings
- **Voice not working**: Check browser microphone permissions
