import React, { useEffect, useRef, useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useAppStore } from '../../stores/appStore'
import { Mic, MicOff, Loader2, AlertCircle, Moon } from 'lucide-react'
import type { UnlistenFn } from '@tauri-apps/api/event'

interface RealtimeSessionConfig {
  api_key: string
  model: string
  voice: string
  instructions: string
  tools: ToolDefinition[]
}

interface ToolDefinition {
  name: string
  description: string
  parameters: any
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number | Date
  session_id?: string
}

export function RealtimeVoiceSession() {
  const { settings, isVoiceActive, stopVoiceSession, addChatMessage } = useAppStore()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSleeping, setIsSleeping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null)
  const eventUnsubscribersRef = useRef<UnlistenFn[]>([])
  const audioQueueRef = useRef<ArrayBuffer[]>([])
  const isPlayingRef = useRef(false)
  
  // PCM16 parameters for OpenAI Realtime API
  const SAMPLE_RATE = 24000 // OpenAI requires 24kHz
  const BUFFER_SIZE = 2048
  
  useEffect(() => {
    if (isVoiceActive && !sessionId) {
      initializeSession()
    }
    
    return () => {
      cleanup()
    }
  }, [isVoiceActive])
  
  const initializeSession = async () => {
    if (!settings.openai_api_key) {
      setError('OpenAI API key not configured')
      return
    }
    
    setIsConnecting(true)
    setError(null)
    
    try {
      // Build tool definitions
      const tools: ToolDefinition[] = [
        {
          name: 'read_file',
          description: 'Read the contents of a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'The file path to read' }
            },
            required: ['path']
          }
        },
        {
          name: 'write_file',
          description: 'Write content to a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'The file path to write to' },
              content: { type: 'string', description: 'The content to write' }
            },
            required: ['path', 'content']
          }
        },
        {
          name: 'execute_command',
          description: 'Execute a terminal command',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'The command to execute' },
              args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' }
            },
            required: ['command']
          }
        },
        {
          name: 'list_files',
          description: 'List files in a directory',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'The directory path' }
            },
            required: ['path']
          }
        }
      ]
      
      const config: RealtimeSessionConfig = {
        api_key: settings.openai_api_key,
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: settings.voice_settings.tts_voice || 'maple',
        instructions: `You are LocalBrain, a helpful AI assistant with access to the user's computer.
You can read and write files, execute terminal commands, and help with various tasks.
Be concise and helpful. When the user says "go to sleep", acknowledge and end the conversation.
Always confirm before executing potentially destructive operations.`,
        tools
      }
      
      // Create realtime session
      const id = await invoke<string>('create_realtime_session', { config })
      setSessionId(id)
      
      // Setup event listeners
      await setupEventListeners(id)
      
      // Start audio capture
      await startAudioCapture(id)
      
      setIsConnecting(false)
      setIsListening(true)
      
      // Add initial message to chat
      addChatMessage({
        role: 'system',
        content: '🎤 Voice conversation started. Say "go to sleep" to end.'
      })
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
      setIsConnecting(false)
      stopVoiceSession()
    }
  }
  
  const setupEventListeners = async (sessionId: string) => {
    // Listen for audio data from the API
    const audioUnlisten = await listen<ArrayBuffer>(`realtime-audio-${sessionId}`, (event) => {
      // Queue audio for playback
      audioQueueRef.current.push(event.payload)
      if (!isPlayingRef.current) {
        playQueuedAudio()
      }
    })
    eventUnsubscribersRef.current.push(audioUnlisten)
    
    // Listen for transcript updates
    const transcriptUnlisten = await listen<string>(`realtime-transcript-${sessionId}`, (event) => {
      setTranscript(prev => prev + event.payload)
      setIsSpeaking(true)
    })
    eventUnsubscribersRef.current.push(transcriptUnlisten)
    
    // Listen for chat messages
    const chatUnlisten = await listen<ConversationMessage>('chat-message', (event) => {
      if (event.payload.session_id === sessionId) {
        addChatMessage({
          ...event.payload,
          timestamp: new Date()
        })
        
        // Clear transcript when message is complete
        if (event.payload.role === 'assistant') {
          setTranscript('')
          setIsSpeaking(false)
        }
      }
    })
    eventUnsubscribersRef.current.push(chatUnlisten)
    
    // Listen for tool executions
    const toolUnlisten = await listen('tool-executed', (event) => {
    })
    eventUnsubscribersRef.current.push(toolUnlisten)
    
    // Listen for speech events
    const speechStartUnlisten = await listen(`realtime-speech-started-${sessionId}`, () => {
      setIsListening(false)
    })
    eventUnsubscribersRef.current.push(speechStartUnlisten)
    
    const speechStopUnlisten = await listen(`realtime-speech-stopped-${sessionId}`, () => {
      setIsListening(true)
    })
    eventUnsubscribersRef.current.push(speechStopUnlisten)
    
    // Listen for sleep mode
    const sleepUnlisten = await listen<boolean>(`realtime-sleeping-${sessionId}`, (event) => {
      setIsSleeping(event.payload)
      if (event.payload) {
        addChatMessage({
          role: 'system',
          content: '😴 Going to sleep. Say "Hey Brain" to wake me up.'
        })
      }
    })
    eventUnsubscribersRef.current.push(sleepUnlisten)
    
    // Listen for errors
    const errorUnlisten = await listen(`realtime-error-${sessionId}`, (event) => {
      setError('Connection error')
    })
    eventUnsubscribersRef.current.push(errorUnlisten)
  }
  
  const startAudioCapture = async (sessionId: string) => {
    try {
      // Request microphone access with specific settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: settings.voice_settings.noise_suppression,
          autoGainControl: true,
          sampleRate: SAMPLE_RATE,
          channelCount: 1
        }
      })
      
      micStreamRef.current = stream
      
      // Create audio context with required sample rate
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE })
      
      const source = audioContextRef.current.createMediaStreamSource(stream)
      
      // Try to use AudioWorklet for better performance
      if (audioContextRef.current.audioWorklet) {
        try {
          // Create inline AudioWorklet processor
          const processorCode = `
            class PCM16Processor extends AudioWorkletProcessor {
              process(inputs, outputs, parameters) {
                const input = inputs[0]
                if (input.length > 0) {
                  const channelData = input[0]
                  
                  // Convert Float32 to PCM16
                  const pcm16 = new Int16Array(channelData.length)
                  for (let i = 0; i < channelData.length; i++) {
                    const sample = Math.max(-1, Math.min(1, channelData[i]))
                    pcm16[i] = sample * 32767
                  }
                  
                  // Send to main thread
                  this.port.postMessage({ audio: pcm16.buffer })
                }
                return true
              }
            }
            registerProcessor('pcm16-processor', PCM16Processor)
          `
          
          const blob = new Blob([processorCode], { type: 'application/javascript' })
          const url = URL.createObjectURL(blob)
          await audioContextRef.current.audioWorklet.addModule(url)
          URL.revokeObjectURL(url)
          
          audioWorkletRef.current = new AudioWorkletNode(audioContextRef.current, 'pcm16-processor')
          audioWorkletRef.current.port.onmessage = async (event) => {
            if (event.data.audio && sessionId) {
              const audioData = new Uint8Array(event.data.audio)
              await invoke('send_realtime_audio', { sessionId, audioData: Array.from(audioData) })
            }
          }
          
          source.connect(audioWorkletRef.current)
          
        } catch (workletError) {
          console.warn('AudioWorklet not available, falling back to ScriptProcessor')
          setupScriptProcessor(source, sessionId)
        }
      } else {
        setupScriptProcessor(source, sessionId)
      }
      
    } catch (err) {
      setError('Microphone access denied')
      throw err
    }
  }
  
  const setupScriptProcessor = (source: MediaStreamAudioSourceNode, sessionId: string) => {
    if (!audioContextRef.current) return
    
    processorRef.current = audioContextRef.current.createScriptProcessor(BUFFER_SIZE, 1, 1)
    
    processorRef.current.onaudioprocess = async (e) => {
      const inputData = e.inputBuffer.getChannelData(0)
      
      // Convert Float32 to PCM16
      const pcm16 = new Int16Array(inputData.length)
      for (let i = 0; i < inputData.length; i++) {
        const sample = Math.max(-1, Math.min(1, inputData[i]))
        pcm16[i] = sample * 32767
      }
      
      // Send to backend
      if (sessionId) {
        const audioData = new Uint8Array(pcm16.buffer)
        await invoke('send_realtime_audio', { sessionId, audioData: Array.from(audioData) })
      }
    }
    
    source.connect(processorRef.current)
    processorRef.current.connect(audioContextRef.current.destination)
  }
  
  const playQueuedAudio = async () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) return
    
    isPlayingRef.current = true
    
    while (audioQueueRef.current.length > 0) {
      const audioData = audioQueueRef.current.shift()!
      
      // Convert PCM16 to Float32
      const pcm16 = new Int16Array(audioData)
      const float32 = new Float32Array(pcm16.length)
      
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768
      }
      
      // Create audio buffer and play
      const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, SAMPLE_RATE)
      audioBuffer.getChannelData(0).set(float32)
      
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContextRef.current.destination)
      
      await new Promise<void>((resolve) => {
        source.onended = () => resolve()
        source.start()
      })
    }
    
    isPlayingRef.current = false
  }
  
  const handleWakeUp = async () => {
    if (sessionId && isSleeping) {
      await invoke('wake_up_realtime_session', { sessionId })
      setIsSleeping(false)
      addChatMessage({
        role: 'system',
        content: '👋 I\'m awake! How can I help you?'
      })
    }
  }
  
  const cleanup = async () => {
    // Unsubscribe from all events
    eventUnsubscribersRef.current.forEach(unsubscribe => unsubscribe())
    eventUnsubscribersRef.current = []
    
    // Stop audio capture
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop())
      micStreamRef.current = null
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    
    if (audioWorkletRef.current) {
      audioWorkletRef.current.disconnect()
      audioWorkletRef.current = null
    }
    
    if (audioContextRef.current) {
      await audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    // Close realtime session
    if (sessionId) {
      await invoke('close_realtime_session', { sessionId })
      setSessionId(null)
    }
    
    // Reset state
    setIsListening(false)
    setIsSpeaking(false)
    setIsSleeping(false)
    setTranscript('')
    audioQueueRef.current = []
    isPlayingRef.current = false
  }
  
  const handleStop = async () => {
    await cleanup()
    stopVoiceSession()
    
    addChatMessage({
      role: 'system',
      content: '🎤 Voice conversation ended.'
    })
  }
  
  if (!isVoiceActive) return null
  
  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl p-6 min-w-[300px] max-w-[400px]">
        {/* Status Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {isConnecting ? (
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            ) : error ? (
              <AlertCircle className="w-5 h-5 text-red-400" />
            ) : isSleeping ? (
              <Moon className="w-5 h-5 text-gray-400" />
            ) : isListening ? (
              <Mic className="w-5 h-5 text-cyan-400 animate-pulse" />
            ) : (
              <MicOff className="w-5 h-5 text-gray-400" />
            )}
            <span className="text-sm font-medium text-gray-200">
              {isConnecting ? 'Connecting...' : 
               error ? 'Error' :
               isSleeping ? 'Sleeping' :
               isSpeaking ? 'Speaking' :
               isListening ? 'Listening' : 'Processing'}
            </span>
          </div>
          <button
            onClick={handleStop}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            End
          </button>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
        
        {/* Transcript */}
        {transcript && (
          <div className="mb-4">
            <p className="text-sm text-gray-300 italic">"{transcript}"</p>
          </div>
        )}
        
        {/* Audio Visualizer */}
        <div className="flex items-center justify-center space-x-1 h-12">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className={`w-1 bg-cyan-400 rounded-full transition-all duration-150 ${
                isSpeaking ? 'animate-pulse' : ''
              }`}
              style={{
                height: isListening || isSpeaking ? `${Math.random() * 30 + 10}px` : '4px',
                animationDelay: `${i * 50}ms`
              }}
            />
          ))}
        </div>
        
        {/* Sleep Mode Actions */}
        {isSleeping && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <button
              onClick={handleWakeUp}
              className="w-full py-2 px-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Wake Up
            </button>
          </div>
        )}
        
        {/* Instructions */}
        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-400 text-center">
            {isSleeping ? 'Say "Hey Brain" or click Wake Up' : 'Say "go to sleep" to pause'}
          </p>
        </div>
      </div>
    </div>
  )
}