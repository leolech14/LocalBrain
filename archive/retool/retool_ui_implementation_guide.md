# LocalBrain UI Implementation Guide for Retool

## Overview
This guide translates the LocalBrain desktop spec into Retool components for building a web-based version at https://leonardolech1.retool.com/

## Four-Pane Layout (F-1)

### Container Structure
```
Container (main)
├── Header (height: 60px)
│   └── Navigation bar with tabs
├── Container (body, flex-row)
│   ├── Container (left-panel, width: 25%)
│   │   └── File Explorer
│   ├── Container (center-panel, width: 50%)
│   │   ├── Container (top, height: 60%)
│   │   │   └── Chat Pane
│   │   └── Container (bottom, height: 40%)
│   │       └── Terminal Pane
│   └── Container (right-panel, width: 25%)
│       └── Preview/Editor Pane
```

## Component Implementation

### 1. Chat Pane Component
**Retool Components:**
- `Container` with vertical layout
- `ListView` for message history
- `TextArea` for user input
- `Button` for send action
- `AudioRecorder` for voice input (F-2)

**Configuration:**
```javascript
// Chat message template
{{
  currentItem.role === 'user' ? 
    '<div class="user-message">' + currentItem.content + '</div>' :
    '<div class="ai-message">' + currentItem.content + '</div>'
}}
```

### 2. Terminal Pane Component (F-8)
**Retool Components:**
- `IFrame` embedding a terminal emulator
- `Tabs` for multi-terminal support
- `Button` group for terminal controls
- `Text` for status badges

**Alternative Implementation:**
```javascript
// Since Retool doesn't have native terminal, use a command executor
const terminalCommands = [
  { id: 1, command: 'ls -la', output: '', status: 'pending' },
  { id: 2, command: 'echo $((2+40))', output: '42', status: 'completed' }
];
```

### 3. File Explorer Component (F-7)
**Retool Components:**
- `Tree` component for file hierarchy
- `Modal` for file operations
- `FileButton` for uploads
- `Table` for detailed file view

**Tree Data Structure:**
```javascript
[
  {
    label: "Project Root",
    value: "/",
    children: [
      {
        label: "src",
        value: "/src",
        children: [
          { label: "main.tsx", value: "/src/main.tsx" }
        ]
      }
    ]
  }
]
```

### 4. Preview/Editor Pane
**Retool Components:**
- `CodeEditor` (Monaco-based)
- `IFrame` for preview
- `Tabs` to switch between editor/preview
- `Button` group for editor actions

## Voice Control Implementation (F-2)

### Voice Input Setup
```javascript
// Voice control state management
const voiceState = {
  isListening: false,
  transcript: '',
  wakeWordDetected: false
};

// Audio recorder query
const processVoiceInput = async (audioBlob) => {
  // Send to STT provider
  const transcript = await sttProvider.transcribe(audioBlob);
  
  // Check for wake word
  if (transcript.toLowerCase().includes('hey brain')) {
    voiceState.wakeWordDetected = true;
    // Process command
  }
};
```

## Context Manager (F-3)

### UI Components
**Retool Components:**
- `Select` for prompt set selection
- `Table` for prompt list
- `Modal` with `Form` for CRUD operations
- `JSONEditor` for prompt configuration

### Data Structure
```javascript
const promptSets = [
  {
    id: 'default',
    name: 'Default Prompts',
    prompts: [
      { role: 'system', content: 'You are LocalBrain...' },
      { role: 'user', content: '{{userInput}}' }
    ]
  }
];
```

## Agents Canvas (F-4)

### Graph Visualization
**Retool Components:**
- `Custom Component` for graph rendering
- `Modal` with `CodeEditor` for node editing
- `Select` for agent type selection
- `Table` for agent properties

**Custom Component Code:**
```javascript
// Using vis.js or d3.js for graph visualization
const AgentGraph = () => {
  const nodes = [
    { id: 1, label: 'Main Agent', x: 0, y: 0 },
    { id: 2, label: 'Code Assistant', x: 100, y: 0 }
  ];
  
  const edges = [
    { from: 1, to: 2 }
  ];
  
  // Render graph
};
```

## Toolkit Library (F-5)

### Components
- `Table` with search and filters
- `Modal` for tool details
- `Button` for tool actions
- `Tags` for categorization

### Schema
```javascript
const tools = [
  {
    id: 'api_1',
    name: 'OpenAI API',
    category: 'AI',
    description: 'GPT-4 integration',
    config: { apiKey: '{{secrets.openai_key}}' }
  }
];
```

## Knowledge Base Browser (F-6)

### Components
- `FileDropzone` for uploads
- `Table` with pagination
- `Select` for filtering
- `Modal` for asset preview

## Security & Settings

### SSO Integration
```javascript
// Auth configuration
const authConfig = {
  provider: 'auth0',
  domain: 'your-domain.auth0.com',
  clientId: '{{environment.AUTH0_CLIENT_ID}}'
};
```

### Settings Panel
**Components:**
- `Form` with sections
- `Switch` for feature toggles
- `Select` for provider selection
- `PasswordInput` for sensitive data

## State Management

### Global State Structure
```javascript
// Use Retool's built-in state management
const appState = {
  user: {{ current_user }},
  settings: {{ localStorage.values.settings || {} }},
  activePane: {{ urlparams.pane || 'chat' }},
  offlineMode: {{ offlineModeSwitch.value }},
  selectedFiles: {{ fileExplorer.selectedFiles }},
  terminalHistory: {{ terminalCommands.data }},
  chatHistory: {{ chatMessages.data }}
};
```

## Responsive Design

### Breakpoints
```css
/* Add to Custom CSS */
@media (max-width: 768px) {
  .left-panel { display: none; }
  .center-panel { width: 100%; }
}
```

## Implementation Steps

1. **Create Main Layout**
   - Add container components
   - Set up responsive grid
   - Configure pane resizing

2. **Implement Chat Interface**
   - Add message list
   - Create input area
   - Wire up send functionality

3. **Add File Explorer**
   - Configure tree component
   - Add file operations
   - Implement Git status colors

4. **Setup Terminal Emulation**
   - Create command executor
   - Add output display
   - Implement command queue

5. **Configure Voice Control**
   - Add audio recorder
   - Setup STT integration
   - Implement wake word detection

6. **Add Settings & Security**
   - Create settings form
   - Add provider selection
   - Implement offline toggle

## Retool-Specific Considerations

1. **Limitations:**
   - No native terminal (use command executor)
   - No direct file system access (use Retool Storage)
   - Limited audio processing (use external APIs)

2. **Workarounds:**
   - Use Custom Components for complex UI
   - Leverage Retool Workflows for background tasks
   - Use Resource Queries for external integrations

3. **Best Practices:**
   - Keep queries lightweight
   - Use transformers for data processing
   - Implement proper error handling
   - Cache frequently accessed data

## Sample Queries

### Chat Query
```sql
-- Get chat history
SELECT * FROM chat_messages 
WHERE session_id = {{ currentSession.id }}
ORDER BY created_at ASC;
```

### File Operations
```javascript
// List files query
const listFiles = {
  resource: 'retoolStorage',
  method: 'list',
  path: {{ currentPath.value }}
};
```

### Voice Processing
```javascript
// STT query
const speechToText = {
  resource: 'openaiAPI',
  endpoint: '/v1/audio/transcriptions',
  method: 'POST',
  body: {
    file: {{ audioRecorder.value }},
    model: 'whisper-1'
  }
};
```

This guide provides a foundation for implementing LocalBrain's UI in Retool. Adapt components and queries based on your specific requirements and available Retool features.