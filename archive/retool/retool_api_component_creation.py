#!/usr/bin/env python3
"""
LocalBrain Custom Components for Retool via API
Creates reusable components that can be used in the Retool app
"""

import requests
import json
import os
from typing import Dict, Any

# Configuration
RETOOL_API_TOKEN = os.getenv("RETOOL_API_TOKEN", "your_api_token_here")
BASE_URL = "https://api.retool.com/api/v2"

headers = {
    "Authorization": f"Bearer {RETOOL_API_TOKEN}",
    "Content-Type": "application/json"
}

# Custom Components for LocalBrain

def create_chat_component():
    """Create a custom chat interface component"""
    component = {
        "name": "LocalBrainChat",
        "description": "AI Chat interface with voice support",
        "code": """
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

  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      padding: '15px'
    }
  }, [
    // Header
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '15px',
        paddingBottom: '10px',
        borderBottom: '1px solid #374151'
      }
    }, [
      React.createElement('span', {
        style: { fontSize: '18px', fontWeight: 'bold', color: '#fff' }
      }, '🧠 LocalBrain Chat'),
      React.createElement('span', {
        style: { 
          marginLeft: 'auto',
          color: isListening ? '#4ade80' : '#6b7280',
          fontSize: '14px'
        }
      }, isListening ? '🎤 Listening...' : '🎤 Say "Hey Brain"')
    ]),
    
    // Messages
    React.createElement('div', {
      style: {
        flex: 1,
        overflowY: 'auto',
        marginBottom: '15px'
      }
    }, [
      ...messages.map((msg, idx) => 
        React.createElement('div', {
          key: idx,
          style: {
            margin: '8px 0',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: msg.role === 'user' ? '#2563eb' : '#374151',
            color: 'white',
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '70%',
            marginLeft: msg.role === 'user' ? 'auto' : '0'
          }
        }, [
          React.createElement('strong', {}, msg.role + ': '),
          msg.content
        ])
      ),
      React.createElement('div', { ref: messagesEndRef })
    ]),
    
    // Input area
    React.createElement('div', {
      style: {
        display: 'flex',
        gap: '10px'
      }
    }, [
      React.createElement('textarea', {
        value: input,
        onChange: (e) => setInput(e.target.value),
        onKeyPress: (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        },
        placeholder: 'Type a message or say "Hey Brain"...',
        style: {
          flex: 1,
          padding: '10px',
          borderRadius: '4px',
          border: '1px solid #374151',
          backgroundColor: '#0f0f0f',
          color: 'white',
          resize: 'none',
          minHeight: '50px'
        }
      }),
      React.createElement('button', {
        onClick: handleSend,
        style: {
          padding: '10px 20px',
          borderRadius: '4px',
          backgroundColor: '#2563eb',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 'bold'
        }
      }, 'Send')
    ])
  ]);
};

return LocalBrainChat;
"""
    }
    
    response = requests.post(
        f"{BASE_URL}/custom-component-library",
        headers=headers,
        json=component
    )
    return response.json()


def create_terminal_component():
    """Create a custom terminal emulator component"""
    component = {
        "name": "LocalBrainTerminal",
        "description": "Terminal emulator with command history",
        "code": """
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

  return React.createElement('div', {
    style: {
      height: '100%',
      backgroundColor: '#000000',
      borderRadius: '8px',
      padding: '10px',
      fontFamily: 'Consolas, Monaco, monospace',
      fontSize: '14px',
      display: 'flex',
      flexDirection: 'column'
    }
  }, [
    // Terminal header
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '10px',
        color: '#00ff00'
      }
    }, [
      React.createElement('span', {}, 'LocalBrain Terminal'),
      React.createElement('span', {
        style: { marginLeft: 'auto', fontSize: '12px', color: '#666' }
      }, `Session: ${new Date().toISOString().split('T')[0]}`)
    ]),
    
    // Terminal output
    React.createElement('div', {
      ref: terminalRef,
      style: {
        flex: 1,
        overflowY: 'auto',
        color: '#00ff00',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word'
      }
    }, history.map((item, idx) => 
      React.createElement('div', { key: idx }, [
        React.createElement('div', {
          style: { color: '#00ff00' }
        }, `$ ${item.command}`),
        React.createElement('div', {
          style: { 
            color: item.error ? '#ff6b6b' : '#ffffff',
            marginBottom: '10px'
          }
        }, item.output || '')
      ])
    )),
    
    // Command input
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        marginTop: '10px'
      }
    }, [
      React.createElement('span', {
        style: { color: '#00ff00', marginRight: '10px' }
      }, '$'),
      React.createElement('input', {
        type: 'text',
        value: command,
        onChange: (e) => setCommand(e.target.value),
        onKeyDown: handleKeyDown,
        placeholder: 'Enter command...',
        style: {
          flex: 1,
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#00ff00',
          fontFamily: 'inherit',
          fontSize: 'inherit'
        }
      })
    ])
  ]);
};

return LocalBrainTerminal;
"""
    }
    
    response = requests.post(
        f"{BASE_URL}/custom-component-library",
        headers=headers,
        json=component
    )
    return response.json()


def create_file_explorer_component():
    """Create a custom file explorer component"""
    component = {
        "name": "LocalBrainFileExplorer",
        "description": "File tree explorer with Git status",
        "code": """
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
      .map((item, idx) => 
        React.createElement('div', { key: idx }, [
          React.createElement('div', {
            onClick: () => {
              if (item.type === 'folder') {
                toggleFolder(item.path);
              } else {
                onFileSelect(item);
              }
            },
            style: {
              padding: '4px 8px',
              paddingLeft: `${level * 20 + 8}px`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: selectedFile === item.path ? '#374151' : 'transparent',
              color: getGitStatusColor(item.gitStatus),
              ':hover': { backgroundColor: '#374151' }
            }
          }, [
            React.createElement('span', {
              style: { marginRight: '8px' }
            }, getFileIcon(item)),
            React.createElement('span', {}, item.name),
            item.gitStatus && React.createElement('span', {
              style: { 
                marginLeft: 'auto', 
                fontSize: '12px',
                opacity: 0.7
              }
            }, item.gitStatus[0].toUpperCase())
          ]),
          item.type === 'folder' && 
          expandedFolders.has(item.path) && 
          item.children && 
          renderFileTree(item.children, level + 1)
        ])
      );
  };

  return React.createElement('div', {
    style: {
      height: '100%',
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column'
    }
  }, [
    // Search bar
    React.createElement('input', {
      type: 'text',
      placeholder: '🔍 Search files...',
      value: searchTerm,
      onChange: (e) => setSearchTerm(e.target.value),
      style: {
        padding: '8px',
        marginBottom: '10px',
        borderRadius: '4px',
        border: '1px solid #374151',
        backgroundColor: '#0f0f0f',
        color: 'white'
      }
    }),
    
    // File tree
    React.createElement('div', {
      style: {
        flex: 1,
        overflowY: 'auto',
        fontSize: '14px',
        color: '#ffffff'
      }
    }, renderFileTree(files))
  ]);
};

return LocalBrainFileExplorer;
"""
    }
    
    response = requests.post(
        f"{BASE_URL}/custom-component-library",
        headers=headers,
        json=component
    )
    return response.json()


def create_agent_canvas_component():
    """Create a custom agent network visualization component"""
    component = {
        "name": "LocalBrainAgentCanvas",
        "description": "Agent network visualization with interactive nodes",
        "code": """
const LocalBrainAgentCanvas = ({ agents = [], connections = [], onAgentClick }) => {
  const canvasRef = React.useRef(null);
  const [selectedAgent, setSelectedAgent] = React.useState(null);
  
  React.useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw connections
    connections.forEach(conn => {
      const fromAgent = agents.find(a => a.id === conn.from);
      const toAgent = agents.find(a => a.id === conn.to);
      
      if (fromAgent && toAgent) {
        ctx.beginPath();
        ctx.moveTo(fromAgent.x, fromAgent.y);
        ctx.lineTo(toAgent.x, toAgent.y);
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
    
    // Draw agents
    agents.forEach(agent => {
      // Agent circle
      ctx.beginPath();
      ctx.arc(agent.x, agent.y, 30, 0, 2 * Math.PI);
      ctx.fillStyle = agent.color || '#4ade80';
      ctx.fill();
      ctx.strokeStyle = selectedAgent?.id === agent.id ? '#ffffff' : '#1f2937';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Agent label
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(agent.name, agent.x, agent.y + 45);
    });
  }, [agents, connections, selectedAgent]);
  
  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if click is on an agent
    const clickedAgent = agents.find(agent => {
      const distance = Math.sqrt(Math.pow(x - agent.x, 2) + Math.pow(y - agent.y, 2));
      return distance <= 30;
    });
    
    if (clickedAgent) {
      setSelectedAgent(clickedAgent);
      onAgentClick && onAgentClick(clickedAgent);
    }
  };
  
  return React.createElement('div', {
    style: {
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      padding: '15px',
      height: '100%'
    }
  }, [
    React.createElement('h3', {
      style: { color: '#ffffff', marginBottom: '15px' }
    }, '🤖 Agent Network'),
    
    React.createElement('canvas', {
      ref: canvasRef,
      width: 600,
      height: 400,
      onClick: handleCanvasClick,
      style: {
        width: '100%',
        height: 'calc(100% - 50px)',
        backgroundColor: '#0f0f0f',
        borderRadius: '4px',
        cursor: 'pointer'
      }
    }),
    
    selectedAgent && React.createElement('div', {
      style: {
        marginTop: '10px',
        padding: '10px',
        backgroundColor: '#374151',
        borderRadius: '4px',
        color: '#ffffff',
        fontSize: '14px'
      }
    }, `Selected: ${selectedAgent.name} - ${selectedAgent.description || 'No description'}`)
  ]);
};

return LocalBrainAgentCanvas;
"""
    }
    
    response = requests.post(
        f"{BASE_URL}/custom-component-library",
        headers=headers,
        json=component
    )
    return response.json()


def list_existing_components():
    """List all existing custom components"""
    response = requests.get(
        f"{BASE_URL}/custom-component-library",
        headers=headers
    )
    return response.json()


def delete_component(component_id: str):
    """Delete a custom component"""
    response = requests.delete(
        f"{BASE_URL}/custom-component-library/{component_id}",
        headers=headers
    )
    return response.status_code == 204


def main():
    """Create all LocalBrain components"""
    print("🧠 LocalBrain Retool Component Creator")
    print("=" * 50)
    
    # List existing components
    print("\n📋 Checking existing components...")
    try:
        existing = list_existing_components()
        if existing.get('data'):
            print(f"Found {len(existing['data'])} existing components")
            for comp in existing['data']:
                print(f"  - {comp.get('name')} (ID: {comp.get('id')})")
    except Exception as e:
        print(f"Error listing components: {e}")
    
    # Create components
    components_to_create = [
        ("Chat Interface", create_chat_component),
        ("Terminal Emulator", create_terminal_component),
        ("File Explorer", create_file_explorer_component),
        ("Agent Canvas", create_agent_canvas_component)
    ]
    
    print("\n🚀 Creating LocalBrain components...")
    for name, create_func in components_to_create:
        print(f"\n📦 Creating {name}...")
        try:
            result = create_func()
            if result.get('success'):
                print(f"✅ {name} created successfully!")
                print(f"   ID: {result.get('data', {}).get('id')}")
            else:
                print(f"❌ Failed to create {name}: {result}")
        except Exception as e:
            print(f"❌ Error creating {name}: {e}")
    
    print("\n✨ Component creation complete!")
    print("\n📝 Next steps:")
    print("1. Go to your Retool app")
    print("2. In the component panel, look for 'Custom Components'")
    print("3. Drag and drop the LocalBrain components onto your canvas")
    print("4. Configure the component properties and event handlers")
    print("\n🔧 Example usage in Retool:")
    print("```")
    print("// For LocalBrainChat component:")
    print("messages: {{ chatHistory.data }}")
    print("onSendMessage: {{ sendChatMessage.trigger() }}")
    print("isListening: {{ voiceRecorder.isRecording }}")
    print("```")


if __name__ == "__main__":
    main()