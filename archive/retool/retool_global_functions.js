// LocalBrain Global Functions for Retool
// Add this to your Retool app's global JavaScript section

// ========================================
// LocalBrain API Helpers
// ========================================

window.LocalBrain = {
  // API Configuration
  config: {
    apiUrl: 'http://localhost:3001/api',
    wsUrl: 'ws://localhost:3001/ws',
    retryAttempts: 3,
    retryDelay: 1000
  },

  // WebSocket connection management
  ws: null,
  wsReconnectTimer: null,
  wsListeners: new Map(),

  // Initialize WebSocket connection
  initWebSocket: function() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve(this.ws);
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.wsUrl);
      
      this.ws.onopen = () => {
        console.log('LocalBrain WebSocket connected');
        if (this.wsReconnectTimer) {
          clearInterval(this.wsReconnectTimer);
          this.wsReconnectTimer = null;
        }
        resolve(this.ws);
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      };

      this.ws.onclose = () => {
        console.log('LocalBrain WebSocket disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('LocalBrain WebSocket error:', error);
        reject(error);
      };
    });
  },

  // Handle incoming WebSocket messages
  handleWebSocketMessage: function(data) {
    const { type, name, payload } = data;
    
    // Emit to registered listeners
    if (this.wsListeners.has(name)) {
      this.wsListeners.get(name).forEach(callback => {
        callback(payload);
      });
    }

    // Handle specific message types
    switch (type) {
      case 'terminal-output':
        this.handleTerminalOutput(data);
        break;
      case 'voice-transcript':
        this.handleVoiceTranscript(data);
        break;
      case 'file-change':
        this.handleFileChange(data);
        break;
    }
  },

  // Subscribe to WebSocket events
  subscribe: function(eventName, callback) {
    if (!this.wsListeners.has(eventName)) {
      this.wsListeners.set(eventName, []);
    }
    this.wsListeners.get(eventName).push(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.wsListeners.get(eventName);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  },

  // Attempt to reconnect WebSocket
  attemptReconnect: function() {
    if (!this.wsReconnectTimer) {
      this.wsReconnectTimer = setInterval(() => {
        console.log('Attempting WebSocket reconnection...');
        this.initWebSocket();
      }, 5000);
    }
  },

  // API request wrapper with retry logic
  apiRequest: async function(endpoint, options = {}) {
    const url = `${this.config.apiUrl}${endpoint}`;
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.values.localbrainToken || ''}`
      }
    };

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    let lastError;
    for (let i = 0; i < this.config.retryAttempts; i++) {
      try {
        const response = await fetch(url, finalOptions);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        lastError = error;
        if (i < this.config.retryAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }
    throw lastError;
  }
};

// ========================================
// Terminal Management
// ========================================

window.TerminalManager = {
  sessions: new Map(),
  activeSession: null,

  // Create a new terminal session
  createSession: async function(options = {}) {
    const response = await LocalBrain.apiRequest('/terminal/create', {
      method: 'POST',
      body: JSON.stringify({
        shell: options.shell || '/bin/zsh',
        workingDir: options.workingDir || process.env.HOME || '/tmp',
        cols: options.cols || 80,
        rows: options.rows || 24
      })
    });

    if (response.success) {
      const sessionId = response.data;
      this.sessions.set(sessionId, {
        id: sessionId,
        output: '',
        history: []
      });
      this.activeSession = sessionId;

      // Subscribe to terminal output
      LocalBrain.subscribe(`terminal-output-${sessionId}`, (output) => {
        this.appendOutput(sessionId, output);
      });

      return sessionId;
    }
    throw new Error(response.error || 'Failed to create terminal');
  },

  // Send input to terminal
  sendInput: async function(sessionId, input) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Terminal session not found');

    session.history.push(input);
    
    return await LocalBrain.apiRequest('/terminal/input', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        input: input + '\n'
      })
    });
  },

  // Append output to terminal
  appendOutput: function(sessionId, output) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.output += output;
      // Trigger Retool update
      if (window.terminalOutput && this.activeSession === sessionId) {
        window.terminalOutput.setValue(session.output);
      }
    }
  },

  // Clear terminal output
  clearOutput: function(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.output = '';
      if (window.terminalOutput && this.activeSession === sessionId) {
        window.terminalOutput.setValue('');
      }
    }
  }
};

// ========================================
// Voice Control
// ========================================

window.VoiceControl = {
  isListening: false,
  sessionId: null,
  mediaRecorder: null,
  audioChunks: [],

  // Start voice session
  startListening: async function(options = {}) {
    if (this.isListening) return;

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create voice session
      const response = await LocalBrain.apiRequest('/voice/start', {
        method: 'POST',
        body: JSON.stringify({
          mode: options.mode || 'chain',
          sttProvider: options.sttProvider || 'openai',
          ttsProvider: options.ttsProvider || 'openai'
        })
      });

      if (response.success) {
        this.sessionId = response.data;
        this.isListening = true;

        // Set up media recorder
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          await this.sendAudioData(audioBlob);
          this.audioChunks = [];
        };

        // Start recording
        this.mediaRecorder.start(100); // Collect data every 100ms

        // Update UI
        if (window.voiceActive) {
          window.voiceActive.setValue(true);
        }

        return this.sessionId;
      }
    } catch (error) {
      console.error('Failed to start voice session:', error);
      throw error;
    }
  },

  // Stop voice session
  stopListening: async function() {
    if (!this.isListening) return;

    try {
      // Stop recording
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // Stop all tracks
      if (this.mediaRecorder && this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }

      // Stop voice session
      if (this.sessionId) {
        await LocalBrain.apiRequest('/voice/stop', {
          method: 'POST',
          body: JSON.stringify({ sessionId: this.sessionId })
        });
      }

      this.isListening = false;
      this.sessionId = null;
      this.mediaRecorder = null;

      // Update UI
      if (window.voiceActive) {
        window.voiceActive.setValue(false);
      }
    } catch (error) {
      console.error('Failed to stop voice session:', error);
    }
  },

  // Send audio data to backend
  sendAudioData: async function(audioBlob) {
    if (!this.sessionId) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const arrayBuffer = reader.result;
      const audioData = Array.from(new Uint8Array(arrayBuffer));

      await LocalBrain.apiRequest('/voice/chunk', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: this.sessionId,
          audioData: audioData
        })
      });
    };
    reader.readAsArrayBuffer(audioBlob);
  },

  // Speak text using TTS
  speak: async function(text, options = {}) {
    const response = await LocalBrain.apiRequest('/voice/speak', {
      method: 'POST',
      body: JSON.stringify({
        text,
        voice: options.voice || 'maple',
        provider: options.provider || 'openai'
      })
    });

    if (response.success && response.data) {
      // Convert audio data to blob and play
      const audioData = new Uint8Array(response.data);
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      return new Promise((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audio.onerror = reject;
        audio.play();
      });
    }
  }
};

// ========================================
// File System Utilities
// ========================================

window.FileSystem = {
  currentPath: '/',
  fileCache: new Map(),

  // Load directory contents
  loadDirectory: async function(path) {
    const response = await LocalBrain.apiRequest('/files/list', {
      method: 'GET',
      params: new URLSearchParams({ path })
    });

    if (response.success) {
      this.currentPath = path;
      return this.formatFileTree(response.data);
    }
    throw new Error(response.error || 'Failed to load directory');
  },

  // Read file content
  readFile: async function(path) {
    // Check cache first
    if (this.fileCache.has(path)) {
      return this.fileCache.get(path);
    }

    const response = await LocalBrain.apiRequest('/files/read', {
      method: 'GET',
      params: new URLSearchParams({ path })
    });

    if (response.success) {
      this.fileCache.set(path, response.data);
      return response.data;
    }
    throw new Error(response.error || 'Failed to read file');
  },

  // Write file content
  writeFile: async function(path, content) {
    const response = await LocalBrain.apiRequest('/files/write', {
      method: 'POST',
      body: JSON.stringify({ path, content })
    });

    if (response.success) {
      // Update cache
      this.fileCache.set(path, content);
      return true;
    }
    throw new Error(response.error || 'Failed to write file');
  },

  // Format file tree for Retool tree component
  formatFileTree: function(files) {
    return files.map(file => ({
      key: file.path,
      title: file.name,
      isLeaf: !file.is_dir,
      icon: file.is_dir ? '📁' : this.getFileIcon(file.name),
      children: file.is_dir ? [] : undefined,
      size: file.size,
      modified: file.modified
    }));
  },

  // Get file icon based on extension
  getFileIcon: function(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
      js: '📜', jsx: '⚛️', ts: '📘', tsx: '⚛️',
      py: '🐍', rs: '🦀', go: '🐹',
      html: '🌐', css: '🎨', scss: '🎨',
      json: '📋', md: '📝', txt: '📄',
      png: '🖼️', jpg: '🖼️', svg: '🎨',
      mp3: '🎵', mp4: '🎬', pdf: '📕'
    };
    return iconMap[ext] || '📄';
  }
};

// ========================================
// Chat & AI Utilities
// ========================================

window.ChatManager = {
  messages: [],
  context: [],
  
  // Send chat message
  sendMessage: async function(message, options = {}) {
    // Add user message to history
    const userMessage = {
      id: this.generateId(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    this.messages.push(userMessage);
    this.updateUI();

    try {
      const response = await LocalBrain.apiRequest('/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          message,
          context: options.context || this.context,
          sessionId: options.sessionId || 'default',
          model: options.model || 'gpt-4'
        })
      });

      if (response.success) {
        const assistantMessage = {
          id: this.generateId(),
          role: 'assistant',
          content: response.data,
          timestamp: new Date().toISOString()
        };
        this.messages.push(assistantMessage);
        this.updateUI();

        // Check for action commands
        this.parseActions(response.data);

        return assistantMessage;
      }
    } catch (error) {
      const errorMessage = {
        id: this.generateId(),
        role: 'system',
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString()
      };
      this.messages.push(errorMessage);
      this.updateUI();
      throw error;
    }
  },

  // Parse and execute action commands
  parseActions: function(content) {
    const actionRegex = /action:\s*```([\s\S]*?)```/g;
    let match;
    
    while ((match = actionRegex.exec(content)) !== null) {
      const command = match[1].trim();
      this.executeAction(command);
    }
  },

  // Execute action command
  executeAction: async function(command) {
    const [cmd, ...args] = command.split(' ');
    
    switch (cmd) {
      case 'terminal':
        if (window.TerminalManager.activeSession) {
          await window.TerminalManager.sendInput(
            window.TerminalManager.activeSession,
            args.join(' ')
          );
        }
        break;
      case 'open':
        const path = args.join(' ');
        const content = await window.FileSystem.readFile(path);
        if (window.codeEditor) {
          window.codeEditor.setValue(content);
        }
        break;
      case 'speak':
        await window.VoiceControl.speak(args.join(' '));
        break;
    }
  },

  // Add context
  addContext: function(contextItem) {
    this.context.push(contextItem);
    this.updateUI();
  },

  // Clear context
  clearContext: function() {
    this.context = [];
    this.updateUI();
  },

  // Update UI
  updateUI: function() {
    if (window.messages) {
      window.messages.setValue(this.messages);
    }
    if (window.currentContext) {
      window.currentContext.setValue(this.context);
    }
  },

  // Generate unique ID
  generateId: function() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

// ========================================
// Agent Management
// ========================================

window.AgentManager = {
  agents: new Map(),
  connections: [],

  // Create agent network data
  getNetworkData: function() {
    const nodes = Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      label: agent.name,
      color: agent.active ? '#4ade80' : '#6b7280',
      size: agent.importance || 30
    }));

    const edges = this.connections.map(conn => ({
      from: conn.from,
      to: conn.to,
      arrows: 'to',
      color: { color: '#4ade80' }
    }));

    return { nodes, edges };
  },

  // Add agent
  addAgent: function(agent) {
    this.agents.set(agent.id, agent);
    this.updateVisualization();
  },

  // Connect agents
  connectAgents: function(fromId, toId) {
    this.connections.push({ from: fromId, to: toId });
    this.updateVisualization();
  },

  // Update visualization
  updateVisualization: function() {
    if (window.agentNetworkData) {
      window.agentNetworkData.setValue(this.getNetworkData());
    }
  }
};

// ========================================
// Settings Management
// ========================================

window.SettingsManager = {
  defaults: {
    offlineMode: false,
    sttProvider: 'openai',
    ttsProvider: 'openai',
    llmProvider: 'openai',
    theme: 'dark',
    autoSpeak: false,
    auditLogging: true,
    allowedRoots: ['/Users', '/tmp'],
    terminalShell: '/bin/zsh',
    voiceWakeWord: 'Hey Brain'
  },

  // Load settings
  load: function() {
    const stored = localStorage.getItem('localbrainSettings');
    if (stored) {
      return { ...this.defaults, ...JSON.parse(stored) };
    }
    return this.defaults;
  },

  // Save settings
  save: async function(settings) {
    localStorage.setItem('localbrainSettings', JSON.stringify(settings));
    
    // Update backend
    await LocalBrain.apiRequest('/settings/update', {
      method: 'POST',
      body: JSON.stringify(settings)
    });

    // Apply settings
    this.apply(settings);
  },

  // Apply settings
  apply: function(settings) {
    // Update UI theme
    if (settings.theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }

    // Update offline mode indicator
    if (window.offlineMode) {
      window.offlineMode.setValue(settings.offlineMode);
    }

    // Update providers
    LocalBrain.config.providers = {
      stt: settings.sttProvider,
      tts: settings.ttsProvider,
      llm: settings.llmProvider
    };
  }
};

// ========================================
// Utility Functions
// ========================================

window.LocalBrainUtils = {
  // Format file size
  formatFileSize: function(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  },

  // Format relative time
  formatRelativeTime: function(date) {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now - then) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return then.toLocaleDateString();
  },

  // Get file language/mode
  getFileMode: function(filepath) {
    const ext = filepath.split('.').pop().toLowerCase();
    const modeMap = {
      js: 'javascript', jsx: 'javascript',
      ts: 'typescript', tsx: 'typescript',
      py: 'python', rs: 'rust', go: 'go',
      html: 'html', css: 'css', scss: 'scss',
      json: 'json', md: 'markdown', xml: 'xml',
      yaml: 'yaml', yml: 'yaml',
      sh: 'shell', bash: 'shell',
      sql: 'sql', graphql: 'graphql'
    };
    return modeMap[ext] || 'text';
  },

  // Debounce function
  debounce: function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Throttle function
  throttle: function(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // Deep clone object
  deepClone: function(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  // Generate UUID
  uuid: function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

// ========================================
// Initialize on load
// ========================================

window.addEventListener('load', async () => {
  console.log('LocalBrain utilities loaded');
  
  // Initialize WebSocket connection
  try {
    await LocalBrain.initWebSocket();
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
  }

  // Load settings
  const settings = SettingsManager.load();
  SettingsManager.apply(settings);

  // Set up global event handlers
  window.addEventListener('beforeunload', () => {
    // Clean up resources
    if (VoiceControl.isListening) {
      VoiceControl.stopListening();
    }
    if (LocalBrain.ws) {
      LocalBrain.ws.close();
    }
  });
});

console.log('LocalBrain global functions initialized');