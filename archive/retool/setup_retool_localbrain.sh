#!/bin/bash

# LocalBrain Retool Setup Script
# This script helps set up the LocalBrain interface in Retool

echo "🧠 LocalBrain Retool Setup"
echo "========================="

# Check if required files exist
if [ ! -f "retool_localbrain_components.json" ]; then
    echo "❌ Error: retool_localbrain_components.json not found!"
    exit 1
fi

# Create API middleware server (if needed)
echo "📡 Setting up API middleware..."

cat > localbrain_api_server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { invoke } = require('@tauri-apps/api/tauri');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.post('/api/chat/send', async (req, res) => {
  try {
    const result = await invoke('send_chat_message', {
      message: req.body.message,
      context: req.body.context
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/terminal/create', async (req, res) => {
  try {
    const result = await invoke('create_terminal', {
      config: req.body
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/terminal/input', async (req, res) => {
  try {
    const result = await invoke('terminal_send_input', {
      sessionId: req.body.sessionId,
      input: req.body.input
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/files/tree', async (req, res) => {
  try {
    const result = await invoke('read_directory', {
      path: req.query.path || '/'
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/voice/start', async (req, res) => {
  try {
    const result = await invoke('start_voice_session', {
      config: req.body
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/voice/stop', async (req, res) => {
  try {
    const result = await invoke('stop_voice_session', {
      sessionId: req.body.sessionId
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// WebSocket server
const server = app.listen(PORT, () => {
  console.log(`LocalBrain API server running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    // Handle different message types
    switch (data.type) {
      case 'subscribe':
        // Subscribe to Tauri events
        break;
      case 'voice_chunk':
        // Forward voice data
        invoke('voice_add_audio_chunk', {
          sessionId: data.sessionId,
          audioData: data.audioData
        });
        break;
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Forward Tauri events to WebSocket clients
const forwardEvent = (eventName, data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'event',
        name: eventName,
        data: data
      }));
    }
  });
};
EOF

# Create package.json for API server
cat > api_server_package.json << 'EOF'
{
  "name": "localbrain-api-server",
  "version": "1.0.0",
  "description": "API middleware for LocalBrain Retool integration",
  "main": "localbrain_api_server.js",
  "scripts": {
    "start": "node localbrain_api_server.js",
    "dev": "nodemon localbrain_api_server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "ws": "^8.13.0",
    "@tauri-apps/api": "^2.0.0-rc.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
EOF

echo "✅ API server files created"

# Create Retool import instructions
cat > RETOOL_IMPORT_INSTRUCTIONS.md << 'EOF'
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
EOF

echo "📄 Import instructions created"

# Create a test configuration
cat > retool_test_config.json << 'EOF'
{
  "testQueries": {
    "testConnection": {
      "resource": "localbrainAPI",
      "endpoint": "/health",
      "method": "GET"
    },
    "testChat": {
      "resource": "localbrainAPI", 
      "endpoint": "/chat/send",
      "method": "POST",
      "body": {
        "message": "Hello LocalBrain",
        "context": []
      }
    },
    "testTerminal": {
      "resource": "localbrainAPI",
      "endpoint": "/terminal/create",
      "method": "POST",
      "body": {
        "shell": "/bin/bash"
      }
    }
  }
}
EOF

echo "🧪 Test configuration created"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Review the import guide: cat RETOOL_IMPORT_INSTRUCTIONS.md"
echo "2. Start the API server: npm install && npm start"
echo "3. Import retool_localbrain_components.json into Retool"
echo "4. Configure your API resources in Retool"
echo "5. Launch LocalBrain and test the connection"
echo ""
echo "🚀 Happy coding with LocalBrain + Retool!"