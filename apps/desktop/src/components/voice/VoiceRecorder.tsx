import React, { useState, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Mic, MicOff, Volume2 } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'
import { toast } from 'react-hot-toast'

interface VoiceTranscriptEvent {
  session_id: string
  transcript: string
  is_final: boolean
}

export function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const { settings, sendMessage } = useAppStore()

  useEffect(() => {
    // Listen for voice transcript events
    const unlisten = listen<VoiceTranscriptEvent>('voice-transcript', (event) => {
      if (event.payload.session_id === sessionId) {
        setTranscript(event.payload.transcript)
        
        if (event.payload.is_final) {
          // Add the final transcript as a user message
          if (event.payload.transcript.trim()) {
            sendMessage(event.payload.transcript)
            
            // Clear transcript
            setTranscript('')
          }
        }
      }
    })

    return () => {
      unlisten.then(f => f())
    }
  }, [sessionId, sendMessage])

  const startRecording = async () => {
    try {
      // Check if voice is enabled
      if (!settings.voice_enabled) {
        toast.error('Voice is disabled. Enable it in Settings.')
        return
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: settings.voice_settings.noise_suppression,
          autoGainControl: true,
        } 
      })

      // Create voice session
      const config = {
        mode: 'chain',
        stt_provider: settings.offline_mode ? 'whisper-cpp' : 'openai',
        tts_provider: settings.offline_mode ? 'piper' : 'openai',
        voice_model: settings.voice_settings.voice_model,
        response_voice: settings.voice_settings.response_voice,
      }

      const response = await invoke<{ success: boolean; data?: string; error?: string }>('start_voice_session', { config })
      
      if (response.success && response.data) {
        setSessionId(response.data)
        setIsRecording(true)
        audioChunksRef.current = []

        // Setup MediaRecorder
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm'
        })

        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data)
            
            // Send audio chunk to backend
            const reader = new FileReader()
            reader.onloadend = async () => {
              if (reader.result && typeof reader.result === 'string') {
                const base64Data = reader.result.split(',')[1]
                const audioData = Array.from(atob(base64Data), c => c.charCodeAt(0))
                
                await invoke('voice_add_audio_chunk', {
                  sessionId: response.data,
                  audioData
                })
              }
            }
            reader.readAsDataURL(event.data)
          }
        }

        mediaRecorder.start(1000) // Collect data every second
        mediaRecorderRef.current = mediaRecorder
      } else {
        toast.error(response.error || 'Failed to start voice session')
        stream.getTracks().forEach(track => track.stop())
      }
    } catch (error) {
      toast.error('Failed to access microphone')
    }
  }

  const stopRecording = async () => {
    if (mediaRecorderRef.current && sessionId) {
      setIsProcessing(true)
      mediaRecorderRef.current.stop()
      
      // Stop all tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      
      // Stop the voice session
      const response = await invoke<{ success: boolean; error?: string }>('stop_voice_session', { sessionId })
      
      if (!response.success) {
        toast.error(response.error || 'Failed to stop voice session')
      }
      
      setIsRecording(false)
      setIsProcessing(false)
      setSessionId(null)
      mediaRecorderRef.current = null
    }
  }

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const speakText = async (text: string) => {
    if (!settings.voice_settings.auto_speak_responses) {
      return
    }

    try {
      const options = {
        provider: settings.offline_mode ? 'piper' : 'openai',
        voice: settings.voice_settings.response_voice,
      }

      const response = await invoke<{ success: boolean; data?: number[]; error?: string }>('speak_text', { text, options })
      
      if (response.success && response.data) {
        // Convert audio data to blob and play
        const audioData = new Uint8Array(response.data)
        const blob = new Blob([audioData], { type: 'audio/mp3' })
        const audioUrl = URL.createObjectURL(blob)
        const audio = new Audio(audioUrl)
        
        audio.play().catch(e => {
        })
        
        // Clean up
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
        }
      } else {
      }
    } catch (error) {
    }
  }

  return (
    <div className="flex items-center gap-2">
      {transcript && (
        <div className="flex-1 text-sm text-gray-400 truncate">
          {transcript}
        </div>
      )}
      
      <button
        onClick={handleToggleRecording}
        disabled={isProcessing}
        className={`p-2 rounded ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-gray-700'} transition-colors`}
        title={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? (
          <MicOff className="w-3 h-3" />
        ) : (
          <Mic className="w-3 h-3" />
        )}
      </button>

      {settings.voice_settings.auto_speak_responses && (
        <Volume2 className="w-4 h-4 text-gray-500" />
      )}
    </div>
  )
}