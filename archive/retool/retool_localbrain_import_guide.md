# LocalBrain Retool Import Guide

## Overview
This guide helps you import the LocalBrain UI into Retool, creating a web-based interface that communicates with your LocalBrain Tauri backend.

## Prerequisites
1. Retool account (self-hosted or cloud)
2. LocalBrain backend running with API endpoints exposed
3. Retool CCL installed

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Retool UI      │────▶│  LocalBrain API │────▶│  Tauri Backend  │
│  (Web Client)   │     │  (REST/WS)      │     │  (Rust)         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Step 1: Set Up API Resources in Retool

### 1.1 LocalBrain REST API Resource
```javascript
// Resource Name: localbrainAPI
// Base URL: http://localhost:3001 (or your LocalBrain API endpoint)
// Headers:
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{ localStorage.values.localbrainToken }}"
}
```

### 1.2 WebSocket Resource for Real-time Features
```javascript
// Resource Name: localbrainWS
// URL: ws://localhost:3001/ws
// For terminal output, voice streaming, etc.
```

### 1.3 OpenAI API Resource (if not using offline mode)
```javascript
// Resource Name: openaiAPI
// Base URL: https://api.openai.com
// Headers:
{
  "Authorization": "Bearer {{ retoolContext.configVars.OPENAI_API_KEY }}",
  "Content-Type": "application/json"
}
```

## Step 2: Import Core Components

### 2.1 Create New Retool App
1. In Retool, create a new app named "LocalBrain"
2. Set the app theme to dark mode
3. Configure the viewport for desktop (1920x1080 recommended)

### 2.2 Import Component Structure
Use the provided `retool_localbrain_components.json` file:

```bash
# In Retool:
1. Go to your app
2. Click on the "..." menu → "Import app from JSON"
3. Upload retool_localbrain_components.json
```

## Step 3: Configure Core Functionality

### 3.1 Chat Interface
```javascript
// Query: sendChatMessage
const response = await localbrainAPI.post({
  endpoint: '/chat/send',
  body: {
    message: messageInput.value,
    context: currentContext.value,
    sessionId: currentSession.value
  }
});

// Update chat display
chatMessages.setValue([...chatMessages.value, {
  role: 'user',
  content: messageInput.value,
  timestamp: new Date()
}, {
  role: 'assistant', 
  content: response.data,
  timestamp: new Date()
}]);

messageInput.setValue('');
```

### 3.2 Voice Integration
```javascript
// Initialize voice session
const initVoice = async () => {
  const session = await localbrainAPI.post({
    endpoint: '/voice/session/start',
    body: {
      mode: 'chain',
      sttProvider: settings.value.sttProvider,
      ttsProvider: settings.value.ttsProvider
    }
  });
  
  voiceSessionId.setValue(session.id);
  
  // Set up WebSocket for voice streaming
  localbrainWS.connect({
    onMessage: (data) => {
      if (data.type === 'transcript') {
        messageInput.setValue(data.text);
      }
    }
  });
};
```

### 3.3 Terminal Integration
```javascript
// Create terminal session
const createTerminal = async () => {
  const terminal = await localbrainAPI.post({
    endpoint: '/terminal/create',
    body: {
      shell: '/bin/zsh',
      workingDir: currentDirectory.value
    }
  });
  
  // Subscribe to terminal output
  localbrainWS.subscribe(`terminal-output-${terminal.id}`, (output) => {
    terminalOutput.setValue(terminalOutput.value + output);
  });
  
  terminals.setValue([...terminals.value, terminal]);
  activeTerminal.setValue(terminal.id);
};

// Send terminal command
const sendCommand = async () => {
  await localbrainAPI.post({
    endpoint: '/terminal/input',
    body: {
      sessionId: activeTerminal.value,
      input: terminalInput.value + '\n'
    }
  });
  
  terminalInput.setValue('');
};
```

### 3.4 File Explorer
```javascript
// Load directory contents
const loadDirectory = async (path) => {
  const files = await localbrainAPI.get({
    endpoint: '/files/list',
    params: { path }
  });
  
  fileTree.setValue(formatFileTree(files.data));
};

// Read file content
const openFile = async (path) => {
  const content = await localbrainAPI.get({
    endpoint: '/files/read',
    params: { path }
  });
  
  codeEditor.setValue(content.data);
  currentFile.setValue(path);
};
```

## Step 4: UI Layout Configuration

### 4.1 Main Container Structure
```
┌─────────────────────────────────────────────────────────┐
│                      Header Bar                          │
├─────────┬───────────────────────────────┬───────────────┤
│         │                               │               │
│ Sidebar │      Chat/Voice Panel        │  File Explorer│
│         │                               │               │
│         ├───────────────────────────────┤               │
│         │                               │               │
│         │      Terminal Panel           │  Code Editor  │
│         │                               │               │
└─────────┴───────────────────────────────┴───────────────┘
```

### 4.2 Responsive Design
```javascript
// Add to app scripts
const handleResize = () => {
  const width = window.innerWidth;
  
  if (width < 1200) {
    // Stack panels vertically
    mainContainer.setProperty('direction', 'column');
    sidePanel.setProperty('width', '100%');
  } else {
    // Horizontal layout
    mainContainer.setProperty('direction', 'row');
    sidePanel.setProperty('width', '250px');
  }
};
```

## Step 5: State Management

### 5.1 Global State Variables
```javascript
// Create these state variables in Retool:
- currentSession: localStorage backed
- activeTerminal: temporary state
- openFiles: array of open file paths
- settings: localStorage backed
- voiceActive: boolean state
- currentContext: array of context items
```

### 5.2 Persist Settings
```javascript
// Save settings
const saveSettings = () => {
  localStorage.setValue('localbrainSettings', settings.value);
  
  // Apply settings to backend
  localbrainAPI.post({
    endpoint: '/settings/update',
    body: settings.value
  });
};
```

## Step 6: Advanced Features

### 6.1 Agents Canvas Visualization
```javascript
// Custom component for agent network visualization
const agentNetworkCode = `
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
<div id="agentNetwork" style="width: 100%; height: 400px;"></div>
<script>
  window.Retool.subscribe(function(model) {
    const nodes = new vis.DataSet(model.agents || []);
    const edges = new vis.DataSet(model.connections || []);
    
    const container = document.getElementById('agentNetwork');
    const data = { nodes: nodes, edges: edges };
    const options = {
      nodes: {
        shape: 'dot',
        size: 30,
        font: { color: '#ffffff' }
      },
      edges: {
        arrows: 'to',
        color: { color: '#4ade80' }
      },
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based'
      }
    };
    
    const network = new vis.Network(container, data, options);
    
    network.on('click', function(params) {
      if (params.nodes.length > 0) {
        window.Retool.modelUpdate({ selectedAgent: params.nodes[0] });
      }
    });
  });
</script>
`;
```

### 6.2 Context Manager
```javascript
// Load saved contexts
const loadContexts = async () => {
  const contexts = await localbrainAPI.get({
    endpoint: '/contexts/list'
  });
  
  contextList.setData(contexts.data.map(ctx => ({
    value: ctx.id,
    label: ctx.name,
    description: `${ctx.type} - ${ctx.items.length} items`
  })));
};

// Apply context to chat
const applyContext = async (contextId) => {
  const context = await localbrainAPI.get({
    endpoint: `/contexts/${contextId}`
  });
  
  currentContext.setValue(context.data.items);
  
  // Show context indicator
  contextIndicator.setProperty('text', `Context: ${context.data.name}`);
  contextIndicator.setProperty('hidden', false);
};
```

## Step 7: Error Handling & Offline Mode

### 7.1 API Error Handling
```javascript
// Wrap all API calls with error handling
const apiCall = async (fn) => {
  try {
    loadingState.setValue(true);
    const result = await fn();
    return result;
  } catch (error) {
    if (error.status === 401) {
      // Handle auth error
      authModal.open();
    } else if (!navigator.onLine || settings.value.offlineMode) {
      // Fallback to offline mode
      notification.error('Using offline mode');
      return handleOfflineRequest(fn);
    } else {
      notification.error(`Error: ${error.message}`);
    }
  } finally {
    loadingState.setValue(false);
  }
};
```

### 7.2 Offline Mode Support
```javascript
// Check and switch providers
const checkOfflineMode = () => {
  if (settings.value.offlineMode || !navigator.onLine) {
    // Switch to local providers
    currentProviders.setValue({
      llm: 'ollama',
      stt: 'whisper-cpp',
      tts: 'piper'
    });
    
    offlineIndicator.setProperty('hidden', false);
  }
};
```

## Step 8: Deployment

### 8.1 Environment Configuration
```javascript
// retool.config.json
{
  "configVars": {
    "LOCALBRAIN_API_URL": "http://localhost:3001",
    "OPENAI_API_KEY": "{{ secrets.openai_key }}",
    "ENABLE_VOICE": true,
    "DEFAULT_THEME": "dark"
  }
}
```

### 8.2 Security Considerations
1. Use Retool's built-in authentication
2. Implement API key rotation
3. Enable audit logging
4. Restrict file system access paths
5. Use HTTPS in production

## Step 9: Testing

### 9.1 Component Tests
```javascript
// Test chat functionality
const testChat = async () => {
  await messageInput.setValue('Hello LocalBrain');
  await sendButton.click();
  
  // Verify message appears
  const messages = chatMessages.data;
  return messages[messages.length - 1].content.includes('Hello');
};

// Test terminal
const testTerminal = async () => {
  await createTerminalButton.click();
  await utils.wait(1000);
  
  await terminalInput.setValue('echo "test"');
  await terminalInput.submit();
  
  return terminalOutput.value.includes('test');
};
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check CORS settings on LocalBrain backend
   - Ensure WebSocket port is open
   - Verify authentication token

2. **File Access Denied**
   - Check allowed_roots in LocalBrain settings
   - Verify file permissions

3. **Voice Not Working**
   - Ensure microphone permissions granted
   - Check STT/TTS provider configuration
   - Verify API keys for cloud providers

4. **Terminal Commands Not Executing**
   - Check PTY process permissions
   - Verify shell path exists
   - Check for security restrictions

## Next Steps

1. Customize the UI theme to match your preferences
2. Add keyboard shortcuts for common actions
3. Implement additional plugins and integrations
4. Set up monitoring and analytics
5. Configure backup and recovery procedures

For more information, refer to:
- [Retool Documentation](https://docs.retool.com)
- [LocalBrain API Reference](./API_REFERENCE.md)
- [Tauri Documentation](https://tauri.app)