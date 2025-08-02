# LocalBrain Retool Implementation Steps

## Quick Start for leonardolech1.retool.com

### Step 1: Create the Main Layout

1. **Open your Retool app**: https://leonardolech1.retool.com/editor/cb112456-6e75-11f0-b62c-731c2657e74d/LocalBrain/page1

2. **Clear the canvas** and add a main container:
   - Drag a `Container` component to the canvas
   - Set properties:
     - Height: `100vh`
     - Layout: `Column`
     - Background: `#0f0f0f`

3. **Add Header Container**:
   - Inside main container, add another `Container`
   - Properties:
     - Height: `60px`
     - Layout: `Row`
     - Background: `#1a1a1a`
     - Padding: `0 20px`
   - Add components inside:
     - `Text`: "🧠 LocalBrain" (fontSize: 24px, color: white)
     - `Tabs`: For navigation (Chat, Agents, Tools, Knowledge)

### Step 2: Create the Three-Column Layout

1. **Add Body Container**:
   - Below header, add `Container`
   - Properties:
     - Layout: `Row`
     - Flex: `1`
     - Gap: `10px`
     - Padding: `10px`

2. **Left Panel (File Explorer)**:
   - Add `Container` inside body
   - Width: `25%`
   - Add `Tree` component:
     ```javascript
     // Tree data
     [
       {
         label: "src",
         value: "/src",
         children: [
           { label: "main.tsx", value: "/src/main.tsx" },
           { label: "components", value: "/src/components", children: [] }
         ]
       }
     ]
     ```

3. **Center Panel (Chat + Terminal)**:
   - Add `Container` with width `50%`, layout `Column`
   - Add two child containers:
     - Chat (60% height)
     - Terminal (40% height)

4. **Right Panel (Editor/Preview)**:
   - Add `Container` with width `25%`
   - Add `Tabs` with Editor/Preview options
   - Add `CodeEditor` component

### Step 3: Implement Chat Interface

1. **In the Chat container**, add:
   - `ListView` for messages:
     ```javascript
     // Data source
     {{ chatMessages.data || [] }}
     
     // Item template
     <div style="padding: 10px; margin: 5px; 
                 background: {{item.role === 'user' ? '#2563eb' : '#374151'}}; 
                 color: white; border-radius: 8px;">
       <strong>{{item.role}}:</strong> {{item.content}}
     </div>
     ```

2. **Add Input Area**:
   - Container with row layout
   - `TextInput` component (id: `messageInput`)
   - `Button` component:
     - Text: "Send"
     - Event handler: `{{ sendMessage.trigger() }}`

3. **Create the sendMessage query**:
   ```javascript
   // Resource: REST API
   // Method: POST
   // URL: https://api.openai.com/v1/chat/completions
   // Headers: 
   {
     "Authorization": "Bearer {{ retoolContext.configVars.OPENAI_API_KEY }}",
     "Content-Type": "application/json"
   }
   // Body:
   {
     "model": "gpt-4",
     "messages": [
       {"role": "system", "content": "You are LocalBrain, a helpful AI assistant."},
       ...{{ chatMessages.data || [] }},
       {"role": "user", "content": {{ messageInput.value }}}
     ]
   }
   ```

### Step 4: Implement Terminal Emulator

1. **In Terminal container**, add:
   - `Text` component styled as terminal:
     ```css
     background: black;
     color: #00ff00;
     font-family: monospace;
     padding: 10px;
     height: calc(100% - 40px);
     overflow-y: auto;
     ```

2. **Add Command Input**:
   - `TextInput` with monospace font
   - Placeholder: "$ Enter command..."
   - onSubmit event handler

3. **Create executeCommand query**:
   ```javascript
   // Since Retool can't execute real terminal commands,
   // simulate with a custom API or use predefined responses
   const simulatedCommands = {
     "ls": "file1.txt  file2.js  folder/",
     "pwd": "/home/user/project",
     "echo $((2+40))": "42"
   };
   
   return simulatedCommands[command] || `Command not found: ${command}`;
   ```

### Step 5: Add Voice Control

1. **Add Audio Recorder** (if available in your Retool version):
   - Place near chat input
   - Configure to save as base64

2. **Create Speech-to-Text query**:
   ```javascript
   // Resource: OpenAI API
   // Endpoint: /v1/audio/transcriptions
   // Method: POST
   // Body (form-data):
   {
     "file": {{ audioRecorder.recordingData }},
     "model": "whisper-1"
   }
   ```

3. **Add Voice Indicator**:
   - Container with icon and text
   - Show "Listening..." when active

### Step 6: Implement Settings Modal

1. **Add Settings Button** in header
2. **Create Modal** with form:
   ```javascript
   // Form fields
   [
     {
       type: "switch",
       label: "Offline Mode",
       name: "offlineMode"
     },
     {
       type: "select",
       label: "AI Provider",
       name: "aiProvider",
       options: ["OpenAI", "Local Ollama"]
     }
   ]
   ```

### Step 7: Add State Management

1. **Create Temporary State variables**:
   - `chatMessages` (array)
   - `currentFile` (string)
   - `terminalHistory` (array)
   - `settings` (object)

2. **Add localStorage queries** for persistence:
   ```javascript
   // Save settings
   localStorage.setValue('localBrainSettings', {{ settings.value }})
   
   // Load settings on app load
   {{ localStorage.values.localBrainSettings || {} }}
   ```

### Step 8: Implement Agents Canvas

1. **Create Custom Component**:
   ```html
   <div id="agentNetwork" style="width: 100%; height: 400px;"></div>
   <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
   <script>
   // Agent network visualization
   const nodes = [
     {id: 1, label: 'Main Agent', color: '#4ade80'},
     {id: 2, label: 'Code Agent', color: '#60a5fa'}
   ];
   const edges = [{from: 1, to: 2}];
   
   // Initialize network
   const network = new vis.Network(
     document.getElementById('agentNetwork'),
     {nodes, edges},
     {physics: {enabled: true}}
   );
   </script>
   ```

### Step 9: Add Keyboard Shortcuts

1. **Create JavaScript query**:
   ```javascript
   // Global keyboard shortcuts
   document.addEventListener('keydown', (e) => {
     // Cmd/Ctrl + K: Focus search
     if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
       e.preventDefault();
       messageInput.focus();
     }
     
     // Cmd/Ctrl + Enter: Send message
     if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
       sendMessage.trigger();
     }
   });
   ```

### Step 10: Final Touches

1. **Add Custom CSS**:
   ```css
   /* Dark theme adjustments */
   .retool-container {
     background: #0f0f0f !important;
   }
   
   /* Message bubbles */
   .user-message {
     background: #2563eb;
     margin-left: auto;
     max-width: 70%;
   }
   
   .ai-message {
     background: #374151;
     margin-right: auto;
     max-width: 70%;
   }
   
   /* Terminal styling */
   .terminal {
     font-family: 'Consolas', 'Monaco', monospace;
     line-height: 1.4;
   }
   ```

2. **Configure Resources**:
   - Add OpenAI API resource
   - Add any custom API endpoints
   - Configure authentication

3. **Test Core Features**:
   - Send a chat message
   - Execute a terminal command
   - Switch between editor tabs
   - Test voice input (if implemented)

## Deployment Checklist

- [ ] All API keys in config vars (not hardcoded)
- [ ] Error handling for API failures
- [ ] Loading states for async operations
- [ ] Mobile responsive layout
- [ ] User permissions configured
- [ ] Audit logging enabled (if required)

## Notes

- Some LocalBrain desktop features (like real terminal access) need workarounds in Retool
- Use Retool Workflows for background processing
- Consider Custom Components for complex UI elements
- Leverage Retool's built-in authentication instead of implementing custom SSO

This implementation provides a web-based version of LocalBrain's core features within Retool's capabilities.