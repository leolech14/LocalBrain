import React, { useState, useRef, useEffect } from 'react'
import { Send, Mic } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useAppStore } from '../../stores/appStore'
import { VoiceAmplitudeVisualizer } from '../voice/VoiceAmplitudeVisualizer'

interface VoiceTranscriptEvent {
  session_id: string
  transcript: string
  is_final: boolean
}


interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

export function ChatPanel() {
  const { settings, messages, sendMessage, startVoiceSession, stopVoiceSession, isListening, isVoiceActive } = useAppStore()
  const { voice_enabled: voiceEnabled } = settings
  const [input, setInput] = useState('')
  const [audioStream, setAudioStream] = useState<MediaStream | undefined>()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const unlisten = listen<VoiceTranscriptEvent>('voice-transcript', (event) => {
      if (event.payload.session_id === sessionId) {
        if (event.payload.is_final) {
          sendMessage(event.payload.transcript)
          setInput('')
        } else {
          setInput(event.payload.transcript)
        }
      }
    })

    return () => {
      unlisten.then(f => f())
    }
  }, [sessionId, sendMessage])

  
  // Auto-resize textarea on input change
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [input])
  
  // Add initial message if chat is empty
  useEffect(() => {
    if (messages.length === 0) {
      // Show welcome message
      const welcomeMessage = {
        id: '1',
        role: 'assistant' as const,
        content: 'Hello! I\'m LocalBrain, your AI-powered local environment command center. How can I help you today?',
        timestamp: new Date()
      }
      // This would normally be handled by the store, but for now we'll keep it local
    }
  }, [])
  
  const handleSend = async () => {
    if (!input.trim()) return
    
    await sendMessage(input)
    setInput('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }
  
  const toggleRecording = async () => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop())
        setAudioStream(undefined)
      }
      await stopVoiceSession()
      setSessionId(null)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        setAudioStream(stream)
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
        mediaRecorderRef.current = mediaRecorder
        await startVoiceSession()
        const id = useAppStore.getState().voiceSessionId
        setSessionId(id)
        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && id) {
            const reader = new FileReader()
            reader.onloadend = async () => {
              const base64 = reader.result?.toString().split(',')[1]
              if (base64) {
                const audioData = Array.from(atob(base64), c => c.charCodeAt(0))
                await invoke('voice_add_audio_chunk', { sessionId: id, audioData })
              }
            }
            reader.readAsDataURL(event.data)
          }
        }
        mediaRecorder.start(1000)
      } catch (error) {
        alert('Unable to access microphone. Please check your permissions.')
      }
    }
  }

return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-gray-900">
        <h2 className="text-sm font-semibold">Chat</h2>
        {/* Voice Status */}
        {voiceEnabled && !isVoiceActive && (
          <div className="flex items-center space-x-1 mt-1">
            <Mic className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span className="text-xs text-gray-400">
              Say "Hey Brain" to activate
            </span>
          </div>
        )}
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`rounded-md px-2 py-1 max-w-[85%] ${
                message.role === 'user'
                  ? 'bg-black text-white ml-auto'
                  : message.role === 'assistant'
                  ? 'bg-black text-gray-100'
                  : 'bg-gray-850 text-gray-400'
              }`}
            >
              <p className="text-xs">{message.content}</p>
              <p className="text-xs opacity-60 mt-0.5" style={{ fontSize: '10px' }}>
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="relative border-t border-gray-900">
        <div className="flex items-end space-x-1.5 p-2">
          <div className="flex-1 relative flex flex-col-reverse">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Type your message..."
              className="w-full bg-transparent text-gray-100 text-xs resize-none focus:outline-none border-0 p-0 min-h-[20px] overflow-hidden leading-tight"
              style={{ 
                borderBottom: '1px solid rgba(156, 163, 175, 0.3)',
                paddingBottom: '2px'
              }}
              rows={1}
            />
          </div>
          {voiceEnabled && (
            <button
              onClick={toggleRecording}
              className={`relative rounded-md transition-all duration-300 mb-1 ${
                isListening
                  ? 'bg-transparent'
                  : 'bg-black hover:bg-gray-900 p-1'
              }`}
            >
              {isListening ? (
                <VoiceAmplitudeVisualizer
                  audioStream={audioStream}
                  size={24}
                  className="cursor-pointer"
                />
              ) : (
                <Mic className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>
          )}
          <button
            onClick={handleSend}
            className="p-1 bg-black text-white rounded-md hover:bg-gray-900 transition-colors mb-1"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
