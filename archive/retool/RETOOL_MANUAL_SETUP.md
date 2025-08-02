# LocalBrain Retool Manual Setup Guide

Since the JSON import is having issues, let's build the LocalBrain interface directly in Retool.

## Step 1: Create New App

1. Go to Retool dashboard
2. Click **"Create new" → "App"**
3. Name it **"LocalBrain"**
4. Choose **"Start from scratch"**

## Step 2: Set Dark Theme

1. Click the **paintbrush icon** (top right)
2. Select **"Dark"** theme
3. Set primary color to **#fbbf24** (yellow)

## Step 3: Build the Layout

### 3.1 Main Container
1. Drag a **Container** to the canvas
2. Set properties:
   - Background: `#0a0a0a`
   - Height: `100vh`
   - Padding: `0`

### 3.2 Header
1. Inside main container, add another **Container**
2. Set properties:
   - Background: `#111111`
   - Height: `60px`
   - Border bottom: `1px solid #27272a`

3. Inside header, add:
   - **Text** component: "🧠 LocalBrain"
     - Font size: `24px`
     - Color: `#fbbf24`
     - Font weight: `bold`

### 3.3 Content Area (Split View)
1. Add a **Container** below header
2. Set to **horizontal layout**
3. Add two child containers:

#### Left Panel - Chat
1. **Container** properties:
   - Background: `#111111`
   - Border radius: `8px`
   - Padding: `16px`
   - Width: `50%`

2. Add components:
   - **Text**: "Chat"
   - **List View**: 
     - Name: `messageList`
     - Data: `{{ messages.value }}`
   - **Text Input**:
     - Name: `messageInput`
     - Placeholder: "Type a message..."
   - **Button**: "Send"
     - Event handler: Run `sendMessage`

#### Right Panel - Terminal
1. **Container** properties:
   - Background: `#000000`
   - Border radius: `8px`
   - Width: `50%`

2. Add components:
   - **Text**: "Terminal"
   - **Text** (for output):
     - Name: `terminalOutput`
     - Background: `#000000`
     - Color: `#4ade80`
     - Font: `monospace`
   - **Text Input**:
     - Name: `terminalInput`
     - Background: `#1a1a1a`
     - Color: `#4ade80`

## Step 4: Add State Variables

1. Click **"State"** in left sidebar
2. Add new variables:
   - `messages` - Default: `[]`
   - `terminalHistory` - Default: `[]`
   - `currentDirectory` - Default: `/Users`
   - `isProcessing` - Default: `false`

## Step 5: Create Queries

### 5.1 sendMessage Query
1. Add new **Query** → **JavaScript**
2. Name: `sendMessage`
3. Code:
```javascript
// Add user message
const userMsg = {
  id: Date.now(),
  role: 'user',
  content: messageInput.value,
  timestamp: new Date()
};

messages.setValue([...messages.value, userMsg]);
messageInput.setValue('');
isProcessing.setValue(true);

// Call API
try {
  const response = await fetch('http://localhost:3001/api/chat/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      message: userMsg.content,
      sessionId: 'default'
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    const assistantMsg = {
      id: Date.now() + 1,
      role: 'assistant',
      content: data.data,
      timestamp: new Date()
    };
    messages.setValue([...messages.value, assistantMsg]);
  }
} catch (error) {
  console.error('Error:', error);
} finally {
  isProcessing.setValue(false);
}
```

### 5.2 executeCommand Query
1. Add new **Query** → **JavaScript**
2. Name: `executeCommand`
3. Code:
```javascript
const command = terminalInput.value;
if (!command) return;

// Add to terminal output
terminalOutput.setValue(terminalOutput.value + '\n$ ' + command);
terminalInput.setValue('');

// Execute command
try {
  const response = await fetch('http://localhost:3001/api/terminal/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      command: command,
      cwd: currentDirectory.value
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    terminalOutput.setValue(terminalOutput.value + '\n' + data.output);
  }
} catch (error) {
  terminalOutput.setValue(terminalOutput.value + '\nError: ' + error.message);
}
```

## Step 6: Connect Events

1. **Send Button** → On Click → Run `sendMessage`
2. **Message Input** → On Enter → Run `sendMessage`
3. **Terminal Input** → On Enter → Run `executeCommand`

## Step 7: Add Custom CSS (Optional)

In App Settings → Custom CSS:
```css
/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #1a1a1a;
}

::-webkit-scrollbar-thumb {
  background: #374151;
  border-radius: 4px;
}

/* Message styling */
.message-user {
  background: #2563eb;
  padding: 8px 12px;
  border-radius: 8px;
  margin: 4px 0;
}

.message-assistant {
  background: #374151;
  padding: 8px 12px;
  border-radius: 8px;
  margin: 4px 0;
}
```

## Step 8: Add API Resource

1. Go to **Resources** → **Create New**
2. Choose **REST API**
3. Configure:
   - Name: `localbrainAPI`
   - Base URL: `http://localhost:3001/api`
   - Headers:
     ```json
     {
       "Content-Type": "application/json"
     }
     ```

## Step 9: Add Global JavaScript

1. Go to **Settings** → **Advanced** → **Preloaded JavaScript**
2. Add helper functions:
```javascript
window.LocalBrain = {
  formatMessage(msg) {
    return {
      ...msg,
      displayTime: new Date(msg.timestamp).toLocaleTimeString()
    };
  },
  
  formatTerminalOutput(output) {
    return output.split('\n').map(line => {
      if (line.startsWith('$')) return `<span style="color: #4ade80">${line}</span>`;
      if (line.includes('error')) return `<span style="color: #ef4444">${line}</span>`;
      return line;
    }).join('\n');
  }
};
```

## Done! 🎉

You now have a working LocalBrain interface in Retool. You can expand it by:
- Adding file explorer
- Adding voice controls
- Adding more terminal features
- Connecting to WebSocket for real-time updates