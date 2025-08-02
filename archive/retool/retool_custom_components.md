but w# LocalBrain Custom Components for Retool Editor

Since API access requires Enterprise plan, use these Custom Component codes directly in your Retool editor.

## How to Use:
1. In your Retool app (https://leonardolech1.retool.com/editor/cb112456-6e75-11f0-b62c-731c2657e74d/LocalBrain/page1)
2. Drag a **Custom Component** from the component panel
3. Paste the code below into the component's code editor
4. Configure the model settings as specified

---

## 1. LocalBrain Chat Component

**Component Code:**
```javascript
<script type="text/babel">
  const LocalBrainChat = () => {
    const [messages, setMessages] = React.useState({{ chatMessages.value || [] }});
    const [input, setInput] = React.useState('');
    const [isListening, setIsListening] = React.useState({{ voiceActive.value || false }});
    const messagesEndRef = React.useRef(null);
    
    React.useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    
    React.useEffect(() => {
      setMessages({{ chatMessages.value || [] }});
    }, [{{ chatMessages.value }}]);

    const handleSend = () => {
      if (input.trim()) {
        // Trigger Retool query
        window.parent.postMessage({
          type: 'triggerQuery',
          queryName: 'sendMessage',
          additionalData: { message: input }
        }, '*');
        setInput('');
      }
    };

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        padding: '15px',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '15px',
          paddingBottom: '10px',
          borderBottom: '1px solid #374151'
        }}>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>
            🧠 LocalBrain Chat
          </span>
          <span style={{ 
            marginLeft: 'auto',
            color: isListening ? '#4ade80' : '#6b7280',
            fontSize: '14px'
          }}>
            {isListening ? '🎤 Listening...' : '🎤 Say "Hey Brain"'}
          </span>
        </div>
        
        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          marginBottom: '15px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: msg.role === 'user' ? '#2563eb' : '#374151',
              color: 'white',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '70%',
              wordBreak: 'break-word'
            }}>
              <strong>{msg.role === 'user' ? 'You' : 'LocalBrain'}:</strong> {msg.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input area */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder='Type a message or say "Hey Brain"...'
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #374151',
              backgroundColor: '#0f0f0f',
              color: 'white',
              resize: 'none',
              minHeight: '50px',
              fontFamily: 'inherit',
              fontSize: '14px'
            }}
          />
          <button
            onClick={handleSend}
            style={{
              padding: '10px 20px',
              borderRadius: '4px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            Send
          </button>
        </div>
      </div>
    );
  };

  const ConnectedComponent = Retool.connectReactComponent(LocalBrainChat);
  ReactDOM.render(<ConnectedComponent />, document.getElementById('react'));
</script>

<div id="react"></div>
```

**Model Configuration:**
```javascript
{
  chatMessages: {{ chatMessages.value || [] }},
  voiceActive: {{ voiceRecorder.isRecording || false }}
}
```

---

## 2. LocalBrain Terminal Component

**Component Code:**
```javascript
<script type="text/babel">
  const LocalBrainTerminal = () => {
    const [history, setHistory] = React.useState({{ terminalHistory.value || [] }});
    const [command, setCommand] = React.useState('');
    const [commandHistory, setCommandHistory] = React.useState([]);
    const [historyIndex, setHistoryIndex] = React.useState(-1);
    const terminalRef = React.useRef(null);
    
    React.useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }, [history]);
    
    React.useEffect(() => {
      setHistory({{ terminalHistory.value || [] }});
    }, [{{ terminalHistory.value }}]);

    const executeCommand = (cmd) => {
      if (cmd.trim()) {
        // Add to command history
        setCommandHistory(prev => [...prev, cmd]);
        
        // Trigger Retool query
        window.parent.postMessage({
          type: 'triggerQuery',
          queryName: 'executeCommand',
          additionalData: { command: cmd }
        }, '*');
        
        setCommand('');
        setHistoryIndex(-1);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        executeCommand(command);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setCommand(commandHistory[commandHistory.length - 1 - newIndex] || '');
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setCommand(commandHistory[commandHistory.length - 1 - newIndex] || '');
        } else {
          setHistoryIndex(-1);
          setCommand('');
        }
      }
    };

    return (
      <div style={{
        height: '100%',
        backgroundColor: '#000000',
        borderRadius: '8px',
        padding: '10px',
        fontFamily: 'Consolas, Monaco, monospace',
        fontSize: '14px',
        display: 'flex',
        flexDirection: 'column',
        color: '#00ff00'
      }}>
        {/* Terminal header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '10px',
          paddingBottom: '5px',
          borderBottom: '1px solid #333'
        }}>
          <span>LocalBrain Terminal</span>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#666' }}>
            Session: {new Date().toISOString().split('T')[0]}
          </span>
        </div>
        
        {/* Terminal output */}
        <div
          ref={terminalRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}
        >
          {history.map((item, idx) => (
            <div key={idx} style={{ marginBottom: '10px' }}>
              <div style={{ color: '#00ff00' }}>$ {item.command}</div>
              <div style={{ 
                color: item.error ? '#ff6b6b' : '#ffffff',
                marginLeft: '10px'
              }}>
                {item.output || ''}
              </div>
            </div>
          ))}
        </div>
        
        {/* Command input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginTop: '10px'
        }}>
          <span style={{ marginRight: '10px' }}>$</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter command..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#00ff00',
              fontFamily: 'inherit',
              fontSize: 'inherit'
            }}
            autoFocus
          />
        </div>
      </div>
    );
  };

  const ConnectedComponent = Retool.connectReactComponent(LocalBrainTerminal);
  ReactDOM.render(<ConnectedComponent />, document.getElementById('react'));
</script>

<div id="react"></div>
```

**Model Configuration:**
```javascript
{
  terminalHistory: {{ terminalHistory.value || [] }}
}
```

---

## 3. LocalBrain File Explorer Component

**Component Code:**
```javascript
<script type="text/babel">
  const LocalBrainFileExplorer = () => {
    const [files, setFiles] = React.useState({{ fileTree.value || [] }});
    const [expandedFolders, setExpandedFolders] = React.useState(new Set(['root']));
    const [selectedFile, setSelectedFile] = React.useState({{ selectedFile.value || null }});
    const [searchTerm, setSearchTerm] = React.useState('');
    
    React.useEffect(() => {
      setFiles({{ fileTree.value || [] }});
    }, [{{ fileTree.value }}]);
    
    React.useEffect(() => {
      setSelectedFile({{ selectedFile.value || null }});
    }, [{{ selectedFile.value }}]);

    const toggleFolder = (path) => {
      const newExpanded = new Set(expandedFolders);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      setExpandedFolders(newExpanded);
    };

    const selectFile = (file) => {
      window.parent.postMessage({
        type: 'triggerQuery',
        queryName: 'selectFile',
        additionalData: { file: file }
      }, '*');
    };

    const getFileIcon = (file) => {
      if (file.type === 'folder') return expandedFolders.has(file.path) ? '📂' : '📁';
      const ext = file.name.split('.').pop();
      const iconMap = {
        'js': '📜', 'ts': '📘', 'tsx': '⚛️', 'jsx': '⚛️',
        'py': '🐍', 'rs': '🦀', 'go': '🐹', 'md': '📝',
        'json': '📋', 'yaml': '📋', 'yml': '📋'
      };
      return iconMap[ext] || '📄';
    };

    const getGitStatusColor = (status) => {
      const statusColors = {
        'modified': '#f59e0b',
        'added': '#4ade80',
        'deleted': '#ef4444',
        'untracked': '#6b7280'
      };
      return statusColors[status] || '#ffffff';
    };

    const renderFileTree = (items, level = 0) => {
      return items
        .filter(item => 
          searchTerm === '' || 
          item.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .map((item, idx) => (
          <div key={idx}>
            <div
              onClick={() => {
                if (item.type === 'folder') {
                  toggleFolder(item.path);
                } else {
                  selectFile(item);
                }
              }}
              style={{
                padding: '4px 8px',
                paddingLeft: `${level * 20 + 8}px`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: selectedFile === item.path ? '#374151' : 'transparent',
                color: getGitStatusColor(item.gitStatus),
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedFile === item.path ? '#374151' : 'transparent'}
            >
              <span style={{ marginRight: '8px' }}>{getFileIcon(item)}</span>
              <span>{item.name}</span>
              {item.gitStatus && (
                <span style={{ 
                  marginLeft: 'auto', 
                  fontSize: '12px',
                  opacity: 0.7
                }}>
                  {item.gitStatus[0].toUpperCase()}
                </span>
              )}
            </div>
            {item.type === 'folder' && 
             expandedFolders.has(item.path) && 
             item.children && 
             renderFileTree(item.children, level + 1)}
          </div>
        ));
    };

    return (
      <div style={{
        height: '100%',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        <h3 style={{ color: '#fff', marginBottom: '10px', fontSize: '16px' }}>📁 File Explorer</h3>
        
        {/* Search bar */}
        <input
          type="text"
          placeholder="🔍 Search files..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '8px',
            marginBottom: '10px',
            borderRadius: '4px',
            border: '1px solid #374151',
            backgroundColor: '#0f0f0f',
            color: 'white',
            fontSize: '14px'
          }}
        />
        
        {/* File tree */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          fontSize: '14px',
          color: '#ffffff'
        }}>
          {renderFileTree(files)}
        </div>
      </div>
    );
  };

  const ConnectedComponent = Retool.connectReactComponent(LocalBrainFileExplorer);
  ReactDOM.render(<ConnectedComponent />, document.getElementById('react'));
</script>

<div id="react"></div>
```

**Model Configuration:**
```javascript
{
  fileTree: {{ fileTree.value || [] }},
  selectedFile: {{ selectedFile.value || null }}
}
```

---

## Setup Instructions:

1. **Create State Variables** in Retool:
   - `chatMessages` (array) - Store chat history
   - `terminalHistory` (array) - Store terminal commands/output
   - `fileTree` (array) - Store file structure
   - `selectedFile` (string) - Currently selected file
   - `voiceActive` (boolean) - Voice recording status

2. **Create Queries**:
   - `sendMessage` - Send chat message to LLM
   - `executeCommand` - Execute terminal command
   - `selectFile` - Handle file selection

3. **Event Handlers** - Add to Custom Component:
   ```javascript
   // In the component's Event Handlers section
   window.addEventListener('message', (event) => {
     if (event.data.type === 'triggerQuery') {
       if (event.data.queryName === 'sendMessage') {
         messageInput.setValue(event.data.additionalData.message);
         sendMessage.trigger();
       }
       // Add other query triggers
     }
   });
   ```

4. **Sample Data Structures**:
   ```javascript
   // chatMessages
   [
     { role: 'user', content: 'Hello LocalBrain' },
     { role: 'assistant', content: 'Hello! How can I help you today?' }
   ]
   
   // terminalHistory
   [
     { command: 'ls -la', output: 'total 16\ndrwxr-xr-x  4 user  staff  128 Aug  1 10:00 .' },
     { command: 'echo $((2+40))', output: '42' }
   ]
   
   // fileTree
   [
     {
       name: 'src',
       path: '/src',
       type: 'folder',
       children: [
         { name: 'main.tsx', path: '/src/main.tsx', type: 'file' }
       ]
     }
   ]
   ```

5. **Styling**: Add to App Settings → Custom CSS:
   ```css
   /* Dark theme for Retool */
   ._retool-main-container {
     background-color: #0f0f0f !important;
   }
   ```

These components will give you the core LocalBrain UI functionality within Retool's constraints!