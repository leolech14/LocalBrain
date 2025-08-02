/**
 * LocalBrain Custom Components Creator for Retool
 * Run this script to create custom components via Retool API
 */

const RETOOL_API_TOKEN = process.env.RETOOL_API_TOKEN || 'your_api_token_here';
const BASE_URL = 'https://api.retool.com/api/v2';

const headers = {
  'Authorization': `Bearer ${RETOOL_API_TOKEN}`,
  'Content-Type': 'application/json'
};

// Component definitions
const components = [
  {
    name: 'LocalBrainChat',
    description: 'AI Chat interface with voice support',
    code: `
const LocalBrainChat = ({ messages = [], onSendMessage, isListening = false }) => {
  const [input, setInput] = React.useState('');
  const messagesEndRef = React.useRef(null);
  
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      padding: '15px'
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
        marginBottom: '15px'
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            margin: '8px 0',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: msg.role === 'user' ? '#2563eb' : '#374151',
            color: 'white',
            marginLeft: msg.role === 'user' ? 'auto' : '0',
            marginRight: msg.role === 'user' ? '0' : 'auto',
            maxWidth: '70%',
            width: 'fit-content'
          }}>
            <strong>{msg.role}: </strong>
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
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
            fontFamily: 'inherit'
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
            fontWeight: 'bold'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

return LocalBrainChat;`
  },
  
  {
    name: 'LocalBrainTerminal',
    description: 'Terminal emulator with command history',
    code: `
const LocalBrainTerminal = ({ history = [], onExecuteCommand }) => {
  const [command, setCommand] = React.useState('');
  const [historyIndex, setHistoryIndex] = React.useState(-1);
  const terminalRef = React.useRef(null);
  
  React.useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (command.trim()) {
        onExecuteCommand(command);
        setCommand('');
        setHistoryIndex(-1);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(history[history.length - 1 - newIndex]?.command || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(history[history.length - 1 - newIndex]?.command || '');
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
      flexDirection: 'column'
    }}>
      {/* Terminal header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '10px',
        color: '#00ff00'
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
          color: '#00ff00',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word'
        }}
      >
        {history.map((item, idx) => (
          <div key={idx}>
            <div style={{ color: '#00ff00' }}>$ {item.command}</div>
            <div style={{ 
              color: item.error ? '#ff6b6b' : '#ffffff',
              marginBottom: '10px'
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
        <span style={{ color: '#00ff00', marginRight: '10px' }}>$</span>
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
        />
      </div>
    </div>
  );
};

return LocalBrainTerminal;`
  },
  
  {
    name: 'LocalBrainFileExplorer',
    description: 'File tree explorer with Git status',
    code: `
const LocalBrainFileExplorer = ({ files = [], onFileSelect, selectedFile = null }) => {
  const [expandedFolders, setExpandedFolders] = React.useState(new Set(['root']));
  const [searchTerm, setSearchTerm] = React.useState('');

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
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
                onFileSelect(item);
              }
            }}
            style={{
              padding: '4px 8px',
              paddingLeft: \`\${level * 20 + 8}px\`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: selectedFile === item.path ? '#374151' : 'transparent',
              color: getGitStatusColor(item.gitStatus)
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#374151'}
            onMouseLeave={(e) => e.target.style.backgroundColor = selectedFile === item.path ? '#374151' : 'transparent'}
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
      flexDirection: 'column'
    }}>
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
          color: 'white'
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

return LocalBrainFileExplorer;`
  }
];

// Helper function to create a component
async function createComponent(component) {
  try {
    const response = await fetch(`${BASE_URL}/custom-component-library`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(component)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// List existing components
async function listComponents() {
  try {
    const response = await fetch(`${BASE_URL}/custom-component-library`, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error listing components:', error);
    return null;
  }
}

// Main execution
async function main() {
  console.log('🧠 LocalBrain Retool Component Creator');
  console.log('='.repeat(50));
  
  // Check API token
  if (RETOOL_API_TOKEN === 'your_api_token_here') {
    console.error('❌ Please set your RETOOL_API_TOKEN environment variable');
    console.log('Example: export RETOOL_API_TOKEN="your_actual_token"');
    return;
  }
  
  // List existing components
  console.log('\n📋 Checking existing components...');
  const existing = await listComponents();
  if (existing && existing.data) {
    console.log(`Found ${existing.data.length} existing components:`);
    existing.data.forEach(comp => {
      console.log(`  - ${comp.name} (ID: ${comp.id})`);
    });
  }
  
  // Create components
  console.log('\n🚀 Creating LocalBrain components...');
  
  for (const component of components) {
    console.log(`\n📦 Creating ${component.name}...`);
    const result = await createComponent(component);
    
    if (result.success) {
      console.log(`✅ ${component.name} created successfully!`);
      if (result.data && result.data.data) {
        console.log(`   ID: ${result.data.data.id}`);
      }
    } else {
      console.log(`❌ Failed to create ${component.name}: ${result.error}`);
    }
  }
  
  console.log('\n✨ Component creation complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Go to your Retool app at https://leonardolech1.retool.com');
  console.log('2. In the component panel, look for "Custom Components"');
  console.log('3. Drag the LocalBrain components onto your canvas');
  console.log('4. Configure the properties:');
  console.log('   - LocalBrainChat: messages, onSendMessage, isListening');
  console.log('   - LocalBrainTerminal: history, onExecuteCommand');
  console.log('   - LocalBrainFileExplorer: files, onFileSelect, selectedFile');
}

// Run the script
main().catch(console.error);