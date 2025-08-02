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
