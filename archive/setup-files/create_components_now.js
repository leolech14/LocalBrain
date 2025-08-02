// Direct component creation for Retool
const RETOOL_API_TOKEN = 'retool_01k1hkjwz56dnjxbzgcpwcecg5';
const BASE_URL = 'https://api.retool.com/api/v2';

async function createAllComponents() {
  const headers = {
    'Authorization': `Bearer ${RETOOL_API_TOKEN}`,
    'Content-Type': 'application/json'
  };

  // Component 1: LocalBrainChat
  const chatComponent = {
    name: 'LocalBrainChat',
    description: 'AI Chat interface',
    code: `return ({ messages = [], onSendMessage }) => {
      const [input, setInput] = React.useState('');
      return React.createElement('div', {
        style: { display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '15px' }
      }, [
        React.createElement('div', { style: { flex: 1, overflowY: 'auto', marginBottom: '10px' } },
          messages.map((msg, i) => React.createElement('div', {
            key: i,
            style: {
              margin: '5px 0',
              padding: '10px',
              borderRadius: '6px',
              backgroundColor: msg.role === 'user' ? '#2563eb' : '#374151',
              color: 'white',
              marginLeft: msg.role === 'user' ? 'auto' : '0',
              marginRight: msg.role === 'user' ? '0' : 'auto',
              maxWidth: '70%'
            }
          }, msg.content))
        ),
        React.createElement('div', { style: { display: 'flex', gap: '10px' } }, [
          React.createElement('input', {
            value: input,
            onChange: e => setInput(e.target.value),
            onKeyPress: e => {
              if (e.key === 'Enter') {
                onSendMessage(input);
                setInput('');
              }
            },
            placeholder: 'Type a message...',
            style: { flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #374151', backgroundColor: '#0f0f0f', color: 'white' }
          }),
          React.createElement('button', {
            onClick: () => { onSendMessage(input); setInput(''); },
            style: { padding: '10px 20px', borderRadius: '4px', backgroundColor: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }
          }, 'Send')
        ])
      ]);
    }`
  };

  // Component 2: LocalBrainTerminal
  const terminalComponent = {
    name: 'LocalBrainTerminal',
    description: 'Terminal emulator',
    code: `return ({ history = [], onExecuteCommand }) => {
      const [command, setCommand] = React.useState('');
      return React.createElement('div', {
        style: { height: '100%', backgroundColor: '#000', borderRadius: '8px', padding: '10px', fontFamily: 'monospace', color: '#0f0' }
      }, [
        React.createElement('div', { style: { height: 'calc(100% - 40px)', overflowY: 'auto' } },
          history.map((item, i) => React.createElement('div', { key: i }, [
            React.createElement('div', { style: { color: '#0f0' } }, '$ ' + item.command),
            React.createElement('div', { style: { color: '#fff', marginBottom: '10px' } }, item.output)
          ]))
        ),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center' } }, [
          React.createElement('span', { style: { marginRight: '10px' } }, '$'),
          React.createElement('input', {
            type: 'text',
            value: command,
            onChange: e => setCommand(e.target.value),
            onKeyPress: e => {
              if (e.key === 'Enter') {
                onExecuteCommand(command);
                setCommand('');
              }
            },
            style: { flex: 1, backgroundColor: 'transparent', border: 'none', outline: 'none', color: '#0f0' }
          })
        ])
      ]);
    }`
  };

  // Component 3: LocalBrainFileExplorer
  const fileExplorerComponent = {
    name: 'LocalBrainFileExplorer',
    description: 'File explorer',
    code: `return ({ files = [], onFileSelect }) => {
      const renderTree = (items, level = 0) => items.map((item, i) => 
        React.createElement('div', {
          key: i,
          onClick: () => onFileSelect(item),
          style: {
            padding: '4px 8px',
            paddingLeft: (level * 20 + 8) + 'px',
            cursor: 'pointer',
            color: '#fff',
            ':hover': { backgroundColor: '#374151' }
          }
        }, (item.type === 'folder' ? '📁 ' : '📄 ') + item.name)
      );
      
      return React.createElement('div', {
        style: { height: '100%', backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '10px', overflowY: 'auto' }
      }, renderTree(files));
    }`
  };

  // Create all components
  const components = [chatComponent, terminalComponent, fileExplorerComponent];
  
  for (const comp of components) {
    try {
      const response = await fetch(`${BASE_URL}/custom-component-library`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(comp)
      });
      
      const result = await response.json();
      console.log(`✅ Created ${comp.name}:`, result);
    } catch (error) {
      console.error(`❌ Failed to create ${comp.name}:`, error);
    }
  }
}

// Execute
createAllComponents();