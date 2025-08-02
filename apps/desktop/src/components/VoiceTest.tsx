import React, { useState, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Mic, MicOff, Volume2, VolumeX, Loader } from 'lucide-react'

interface VoiceConfig {
  stt_provider: string
  tts_provider: string
  voice_model: string
  tts_voice: string
  language: string
  wake_word: string
  audio_format: string
}

export function VoiceTest() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState<string>('Idle')
  const [audioLevel, setAudioLevel] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>({
    stt_provider: 'openai',
    tts_provider: 'openai',
    voice_model: 'whisper-1',
    tts_voice: 'alloy',
    language: 'en',
    wake_word: 'hey brain',
    audio_format: 'webm'
  })
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const unlistenersRef = useRef<Function[]>([])
  
  useEffect(() => {
    // Set up event listeners
    const setupListeners = async () => {
      const unlistenTranscript = await listen('voice-transcript', (event: any) => {
        console.log('Transcript:', event.payload)
        setTranscript(event.payload.transcript)
      })
      
      const unlistenResponse = await listen('voice-response', async (event: any) => {
        console.log('Voice response:', event.payload)
        setIsSpeaking(true)
        
        // Play the audio
        if (audioElementRef.current) {
          audioElementRef.current.src = `data:audio/mp3;base64,${event.payload.audio_data}`
          await audioElementRef.current.play()
        }
      })
      
      const unlistenWakeWord = await listen('wake-word-detected', (event: any) => {
        console.log('Wake word detected!', event.payload)
        setStatus('Wake word detected!')
      })
      
      const unlistenCommand = await listen('voice-command', (event: any) => {
        console.log('Voice command:', event.payload)
        setStatus(`Command: ${event.payload.command}`)
      })
      
      const unlistenError = await listen('voice-error', (event: any) => {
        console.error('Voice error:', event.payload)
        setStatus(`Error: ${event.payload.error}`)
      })
      
      unlistenersRef.current = [
        unlistenTranscript,
        unlistenResponse,
        unlistenWakeWord,
        unlistenCommand,
        unlistenError
      ]
    }
    
    setupListeners()
    
    return () => {
      unlistenersRef.current.forEach(fn => fn())
    }
  }, [])
  
  const startSession = async () => {
    try {
      setStatus('Starting voice session...')
      const id = await invoke<string>('voice_create_session', { config: voiceConfig })
      setSessionId(id)
      setStatus('Voice session started')
      console.log('Session ID:', id)
    } catch (error) {
      console.error('Failed to start session:', error)
      setStatus(`Error: ${error}`)
    }
  }
  
  const stopSession = async () => {
    if (!sessionId) return
    
    try {
      await invoke('voice_stop_session', { sessionId })
      setSessionId(null)
      setStatus('Voice session stopped')
      stopRecording()
    } catch (error) {
      console.error('Failed to stop session:', error)
    }
  }
  
  const startRecording = async () => {
    if (!sessionId) {
      await startSession()
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      })
      
      // Set up audio level monitoring
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      
      // Monitor audio levels
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
      const checkAudioLevel = () => {
        if (analyserRef.current && isRecording) {
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          setAudioLevel(average / 255)
          requestAnimationFrame(checkAudioLevel)
        }
      }
      checkAudioLevel()
      
      // Set up MediaRecorder
      const mimeType = 'audio/webm;codecs=opus'
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'audio/webm'
      })
      
      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (event.data.size > 0 && sessionId) {
          // Convert blob to array
          const arrayBuffer = await event.data.arrayBuffer()
          const audioData = Array.from(new Uint8Array(arrayBuffer))
          
          try {
            await invoke('voice_add_audio_chunk', {
              sessionId,
              audioData
            })
          } catch (error) {
            console.error('Failed to send audio chunk:', error)
          }
        }
      }
      
      mediaRecorderRef.current.start(100) // Send chunks every 100ms
      setIsRecording(true)
      setStatus('Recording...')
    } catch (error) {
      console.error('Failed to start recording:', error)
      setStatus(`Error: ${error}`)
    }
  }
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
    
    setIsRecording(false)
    setAudioLevel(0)
    setStatus('Recording stopped')
  }
  
  const speakText = async (text: string) => {
    if (!sessionId) {
      await startSession()
    }
    
    try {
      setStatus('Generating speech...')
      await invoke('voice_speak_text', {
        sessionId: sessionId || '',
        text
      })
    } catch (error) {
      console.error('Failed to speak text:', error)
      setStatus(`Error: ${error}`)
    }
  }
  
  const testWakeWord = async () => {
    // Simulate saying "hey brain"
    const testAudio = generateTestAudio()
    if (sessionId) {
      await invoke('voice_add_audio_chunk', {
        sessionId,
        audioData: Array.from(testAudio)
      })
    }
  }
  
  const generateTestAudio = () => {
    // Generate silence (this would be actual audio in production)
    return new Uint8Array(16000)
  }
  
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Voice System Test</h1>
      
      {/* Configuration */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-semibold text-gray-200">Configuration</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">STT Provider</label>
            <select
              value={voiceConfig.stt_provider}
              onChange={(e) => setVoiceConfig({ ...voiceConfig, stt_provider: e.target.value })}
              className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
            >
              <option value="openai">OpenAI Whisper API</option>
              <option value="whisper-cpp">Local Whisper.cpp</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">TTS Provider</label>
            <select
              value={voiceConfig.tts_provider}
              onChange={(e) => setVoiceConfig({ ...voiceConfig, tts_provider: e.target.value })}
              className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
            >
              <option value="openai">OpenAI TTS</option>
              <option value="piper">Local Piper TTS</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">TTS Voice</label>
            <select
              value={voiceConfig.tts_voice}
              onChange={(e) => setVoiceConfig({ ...voiceConfig, tts_voice: e.target.value })}
              className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
            >
              {voiceConfig.tts_provider === 'openai' ? (
                <>
                  <option value="alloy">Alloy</option>
                  <option value="echo">Echo</option>
                  <option value="fable">Fable</option>
                  <option value="onyx">Onyx</option>
                  <option value="nova">Nova</option>
                  <option value="shimmer">Shimmer</option>
                </>
              ) : (
                <>
                  <option value="en_US-amy-low">Amy (US)</option>
                  <option value="en_US-danny-low">Danny (US)</option>
                  <option value="en_GB-alan-low">Alan (GB)</option>
                </>
              )}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Wake Word</label>
            <input
              type="text"
              value={voiceConfig.wake_word}
              onChange={(e) => setVoiceConfig({ ...voiceConfig, wake_word: e.target.value })}
              className="w-full bg-gray-700 text-gray-200 rounded px-3 py-2"
            />
          </div>
        </div>
      </div>
      
      {/* Status */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Status</p>
            <p className="text-lg font-medium text-gray-200">{status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Session ID</p>
            <p className="text-xs font-mono text-gray-500">{sessionId || 'No active session'}</p>
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex gap-4">
        <button
          onClick={sessionId ? stopSession : startSession}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            sessionId
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-cyan-600 hover:bg-cyan-700 text-white'
          }`}
        >
          {sessionId ? 'Stop Session' : 'Start Session'}
        </button>
        
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!sessionId}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        
        <button
          onClick={testWakeWord}
          disabled={!sessionId}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Test Wake Word
        </button>
      </div>
      
      {/* Audio Level */}
      {isRecording && (
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-2">Audio Level</p>
          <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Transcript */}
      <div className="bg-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-400 mb-2">Transcript</p>
        <p className="text-gray-200 min-h-[60px]">{transcript || 'No transcript yet...'}</p>
      </div>
      
      {/* TTS Test */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <h3 className="text-lg font-semibold text-gray-200">Text-to-Speech Test</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter text to speak..."
            className="flex-1 bg-gray-700 text-gray-200 rounded px-3 py-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value) {
                speakText(e.currentTarget.value)
                e.currentTarget.value = ''
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.querySelector('input[type="text"]') as HTMLInputElement
              if (input?.value) {
                speakText(input.value)
                input.value = ''
              }
            }}
            disabled={!sessionId}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Volume2 className="w-4 h-4" />
            Speak
          </button>
        </div>
      </div>
      
      {/* Hidden audio element for playback */}
      <audio
        ref={audioElementRef}
        onPlay={() => setIsSpeaking(true)}
        onEnded={() => setIsSpeaking(false)}
        className="hidden"
      />
      
      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="fixed bottom-4 right-4 bg-cyan-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 animate-pulse">
          <Volume2 className="w-4 h-4" />
          Speaking...
        </div>
      )}
    </div>
  )
}