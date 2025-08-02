// LocalBrain Custom Components for Retool CCL
// Copy this into src/index.tsx after running setup_retool_ccl.sh

import React, { useState, useEffect, useRef } from 'react';
import { FC } from 'react';
import { useRetoolState, useRetoolTrigger } from '@tryretool/custom-component-support';

// LocalBrain Chat Component
export const LocalBrainChat: FC = () => {
  const [messages, setMessages] = useRetoolState('messages', []);
  const [input, setInput] = useState('');
  const [isListening] = useRetoolState('isListening', false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const sendMessage = useRetoolTrigger('sendMessage');
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      sendMessage({ message: input });
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
        {messages.map((msg: any, idx: number) => (
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

// LocalBrain Terminal Component
export const LocalBrainTerminal: FC = () => {
  const [history, setHistory] = useRetoolState('history', []);
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);
  
  const executeCommand = useRetoolTrigger('executeCommand');
  
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  const handleExecute = (cmd: string) => {
    if (cmd.trim()) {
      setCommandHistory(prev => [...prev, cmd]);
      executeCommand({ command: cmd });
      setCommand('');
      setHistoryIndex(-1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleExecute(command);
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
        {history.map((item: any, idx: number) => (
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

// LocalBrain File Explorer Component
export const LocalBrainFileExplorer: FC = () => {
  const [files] = useRetoolState('files', []);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [selectedFile] = useRetoolState('selectedFile', null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const selectFile = useRetoolTrigger('selectFile');

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileSelect = (file: any) => {
    selectFile({ file });
  };

  const getFileIcon = (file: any) => {
    if (file.type === 'folder') return expandedFolders.has(file.path) ? '📂' : '📁';
    const ext = file.name.split('.').pop();
    const iconMap: Record<string, string> = {
      'js': '📜', 'ts': '📘', 'tsx': '⚛️', 'jsx': '⚛️',
      'py': '🐍', 'rs': '🦀', 'go': '🐹', 'md': '📝',
      'json': '📋', 'yaml': '📋', 'yml': '📋'
    };
    return iconMap[ext] || '📄';
  };

  const getGitStatusColor = (status?: string) => {
    const statusColors: Record<string, string> = {
      'modified': '#f59e0b',
      'added': '#4ade80',
      'deleted': '#ef4444',
      'untracked': '#6b7280'
    };
    return statusColors[status || ''] || '#ffffff';
  };

  const renderFileTree = (items: any[], level = 0): JSX.Element[] => {
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
                handleFileSelect(item);
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

// Export all components
export default {
  LocalBrainChat,
  LocalBrainTerminal,
  LocalBrainFileExplorer
};