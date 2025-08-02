// FILE: apps/desktop/src/stores/appStore.ts
import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
// Types are defined inline below

interface AppSettings {
  voice_enabled: boolean
  offline_mode: boolean
  allowed_roots: string[]
  openai_api_key?: string
  openai_model: string
  tts_provider: string
  stt_provider: string
  theme: string
  window_bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  terminal_settings: {
    shell: string
    font_family: string
    font_size: number
    cursor_style: string
    theme: string
  }
  voice_settings: {
    wake_word: string
    voice_model: string
    response_voice: string
    tts_voice?: string
    auto_speak_responses: boolean
    noise_suppression: boolean
  }
  security_settings: {
    audit_retention_days: number
    require_confirmation: boolean
    sandbox_plugins: boolean
    max_file_size_mb: number
  }
}

interface AppState {
  // State
  isInitialized: boolean
  isLoading: boolean
  error: string | null
  settings: AppSettings
  currentView: string
  sidebarOpen: boolean
  
  // Voice state
  isVoiceActive: boolean
  isListening: boolean
  voiceSessionId: string | null
  
  // Terminal state
  activeTerminals: string[]
  currentTerminal: string | null
  recentTerminalOutput: string
  
  // Chat state
  messages: Array<{
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date
  }>
  
  // File explorer state
  currentPath: string
  selectedFiles: string[]
  
  // Actions
  initialize: () => Promise<void>
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>
  setCurrentView: (view: string) => void
  toggleSidebar: () => void
  
  // Voice actions
  startVoiceSession: (config?: any) => Promise<void>
  stopVoiceSession: () => Promise<void>
  speak: (text: string, options?: any) => Promise<void>
  
  // Terminal actions
  createTerminal: (config?: any) => Promise<string>
  closeTerminal: (terminalId: string) => Promise<void>
  setCurrentTerminal: (terminalId: string) => void
  appendTerminalOutput: (output: string) => void
  
  // Chat actions
  sendMessage: (content: string) => Promise<void>
  addChatMessage: (message: Omit<AppState['messages'][0], 'id' | 'timestamp'> & { timestamp?: Date }) => void
  clearChat: () => void
  
  // File explorer actions
  navigateTo: (path: string) => void
  selectFile: (path: string) => void
  selectFiles: (paths: string[]) => void
  deleteFile: (path: string) => Promise<void>
  
  // Error handling
  setError: (error: string | null) => void
  clearError: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  isInitialized: false,
  isLoading: false,
  error: null,
  settings: {
    voice_enabled: true,
    offline_mode: false,
    allowed_roots: ['/Users', '/tmp'],
    openai_model: 'o3',
    tts_provider: 'openai',
    stt_provider: 'openai',
    theme: 'dark',
    window_bounds: {
      x: 100,
      y: 100,
      width: 1200,
      height: 800,
    },
    terminal_settings: {
      shell: '/bin/zsh',
      font_family: 'JetBrains Mono',
      font_size: 14,
      cursor_style: 'block',
      theme: 'dark',
    },
    voice_settings: {
      wake_word: 'Hey Brain',
      voice_model: 'whisper-1',
      response_voice: 'maple',
      auto_speak_responses: true,
      noise_suppression: true,
    },
    security_settings: {
      audit_retention_days: 90,
      require_confirmation: true,
      sandbox_plugins: true,
      max_file_size_mb: 100,
    },
  },
  currentView: 'chat',
  sidebarOpen: true,
  
  // Voice state
  isVoiceActive: false,
  isListening: false,
  voiceSessionId: null,
  
  // Terminal state
  activeTerminals: [],
  currentTerminal: null,
  recentTerminalOutput: '',
  
  // Chat state
  messages: [],
  
  // File explorer state
  currentPath: '/Users',
  selectedFiles: [],
  
  // Actions
  initialize: async () => {
    set({ isLoading: true, error: null })
    
    try {
      // Get settings from Tauri backend
      const settings = await invoke<AppSettings>('get_settings')
      
      if (settings) {
        set({
          settings,
          isInitialized: true,
          isLoading: false,
        })
        
        // Initialize AI provider with settings
        await invoke('update_ai_config', {
          openaiApiKey: settings.openai_api_key,
          offlineMode: settings.offline_mode
        })
      } else {
        throw new Error('Failed to get settings')
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize app',
        isLoading: false,
      })
    }
  },
  
  updateSettings: async (newSettings: Partial<AppSettings>) => {
    const currentSettings = get().settings
    const updatedSettings = { ...currentSettings, ...newSettings }
    
    try {
      const response = await invoke<{success: boolean, error?: string}>('update_settings', {
        settings: updatedSettings
      })
      
      if (response.success) {
        set({ settings: updatedSettings })
        
        // Update AI provider config if relevant settings changed
        if (newSettings.openai_api_key !== undefined || newSettings.offline_mode !== undefined) {
          await invoke('update_ai_config', {
            openaiApiKey: updatedSettings.openai_api_key,
            offlineMode: updatedSettings.offline_mode
          })
        }
      } else {
        throw new Error(response.error || 'Failed to update settings')
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update settings' })
    }
  },
  
  setCurrentView: (view: string) => {
    set({ currentView: view })
  },
  
  toggleSidebar: () => {
    set(state => ({ sidebarOpen: !state.sidebarOpen }))
  },
  
  // Voice actions
  startVoiceSession: async (config = {}) => {
    // For realtime mode, just update the state
    // The RealtimeVoiceSession component will handle the actual session creation
    if (config.mode === 'realtime') {
      set({
        isVoiceActive: true,
        isListening: false, // Will be set by the realtime component
        voiceSessionId: null, // Will be set by the realtime component
      })
      return
    }
    
    // For other modes, use the existing flow
    try {
      const response = await invoke<{success: boolean, data?: string, error?: string}>('start_voice_session', {
        config
      })
      
      if (response.success && response.data) {
        set({
          isVoiceActive: true,
          isListening: true,
          voiceSessionId: response.data,
        })
      } else {
        throw new Error(response.error || 'Failed to start voice session')
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to start voice session' })
    }
  },
  
  stopVoiceSession: async () => {
    const { voiceSessionId } = get()
    
    if (!voiceSessionId) return
    
    try {
      const response = await invoke<{success: boolean, error?: string}>('stop_voice_session', {
        sessionId: voiceSessionId
      })
      
      if (response.success) {
        set({
          isVoiceActive: false,
          isListening: false,
          voiceSessionId: null,
        })
      } else {
        throw new Error(response.error || 'Failed to stop voice session')
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to stop voice session' })
    }
  },
  
  speak: async (text: string, options = {}) => {
    try {
      const response = await invoke<{success: boolean, error?: string}>('speak_text', {
        text,
        options
      })
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to speak text')
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to speak text' })
    }
  },
  
  // Terminal actions
  createTerminal: async (config = {}) => {
    try {
      const response = await invoke<{success: boolean, data?: string, error?: string}>('create_terminal', {
        config
      })
      
      if (response.success && response.data) {
        set(state => ({
          activeTerminals: [...state.activeTerminals, response.data!],
          currentTerminal: response.data!,
        }))
        return response.data
      } else {
        throw new Error(response.error || 'Failed to create terminal')
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create terminal' })
      throw error
    }
  },
  
  closeTerminal: async (terminalId: string) => {
    try {
      const response = await invoke<{success: boolean, error?: string}>('close_terminal', {
        terminalId
      })
      
      if (response.success) {
        set(state => ({
          activeTerminals: state.activeTerminals.filter(id => id !== terminalId),
          currentTerminal: state.currentTerminal === terminalId ? null : state.currentTerminal,
        }))
      } else {
        throw new Error(response.error || 'Failed to close terminal')
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to close terminal' })
    }
  },
  
  setCurrentTerminal: (terminalId: string) => {
    set({ currentTerminal: terminalId })
  },
  appendTerminalOutput: (output: string) => {
    set(state => {
      const combined = `${state.recentTerminalOutput}${output}`
      const lines = combined.split('\n')
      return { recentTerminalOutput: lines.slice(-20).join('\n') }
    })
  },
  
  // Chat actions
  sendMessage: async (content: string) => {
    const messageId = Date.now().toString()
    const userMessage = {
      id: messageId,
      role: 'user' as const,
      content,
      timestamp: new Date(),
    }
    
    // Add user message immediately
    set(state => ({
      messages: [...state.messages, userMessage]
    }))
    
    try {
      // Prepare messages history for context
      const messages = get().messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const { recentTerminalOutput } = get()
      if (recentTerminalOutput.trim()) {
        messages.unshift({
          role: 'system',
          content: `Recent terminal output:
${recentTerminalOutput}`
        })
      }

      // Add current message to history
      messages.push({
        role: 'user',
        content: content
      })
      
      const response = await invoke<{
        content: string,
        model: string,
        usage: Record<string, number>,
        provider: string
      }>('chat_completion', {
        request: {
          messages,
          model: get().settings.openai_model,
          temperature: 0.7,
          max_tokens: 4000
        }
      })
      
      if (response && response.content) {
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: response.content,
          timestamp: new Date(),
        }
        
        set(state => ({
          messages: [...state.messages, assistantMessage]
        }))
        
        // Auto-speak if enabled
        const { settings } = get()
        if (settings.voice_settings.auto_speak_responses) {
          await get().speak(response.content)
        }
      } else {
        throw new Error('Failed to send message')
      }
    } catch (error) {
      
      const errorMessage = {
        id: (Date.now() + 2).toString(),
        role: 'system' as const,
        content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
        timestamp: new Date(),
      }
      
      set(state => ({
        messages: [...state.messages, errorMessage]
      }))
    }
  },
  
  addChatMessage: (message) => {
    const newMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: message.timestamp || new Date(),
    }
    set(state => ({
      messages: [...state.messages, newMessage]
    }))
  },
  
  clearChat: () => {
    set({ messages: [] })
  },
  
  // File explorer actions
  navigateTo: (path: string) => {
    set({ currentPath: path, selectedFiles: [] })
  },
  
  selectFile: (path: string) => {
    set({ selectedFiles: [path] })
  },
  
  selectFiles: (paths: string[]) => {
    set({ selectedFiles: paths })
  },

  deleteFile: async (path: string) => {
    try {
      const response = await invoke<{success: boolean, error?: string}>('delete_file', { path })
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete file')
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete file' })
      throw error
    }
  },

  // Error handling
  setError: (error: string | null) => {
    set({ error })
  },
  
  clearError: () => {
    set({ error: null })
  },
}))
