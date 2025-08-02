import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { invoke } from '@tauri-apps/api/core'
import { Mic, MicOff } from 'lucide-react'

interface AudioBuffer {
  data: Float32Array
  timestamp: number
}

export function WakeWordDetector() {
  const { settings, startVoiceSession, isVoiceActive } = useAppStore()
  const [isListening, setIsListening] = useState(false)
  const [detectionStatus, setDetectionStatus] = useState<'idle' | 'listening' | 'detected'>('idle')
  const [audioLevel, setAudioLevel] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioBufferRef = useRef<AudioBuffer[]>([])
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastDetectionRef = useRef<number>(0)
  
  // Audio parameters for wake word detection
  const BUFFER_SIZE = 4096
  const SAMPLE_RATE = 16000
  const ENERGY_THRESHOLD = 0.01
  const SILENCE_THRESHOLD = 0.005
  const WAKE_WORD_DURATION = 1500 // 1.5 seconds
  const DETECTION_COOLDOWN = 3000 // 3 seconds between detections
  
  useEffect(() => {
    if (settings.voice_enabled && !isVoiceActive) {
      startListening()
    } else {
      stopListening()
    }
    
    return () => {
      stopListening()
    }
  }, [settings.voice_enabled, isVoiceActive])
  
  const startListening = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: settings.voice_settings.noise_suppression,
          autoGainControl: true,
          sampleRate: SAMPLE_RATE,
        }
      })
      
      streamRef.current = stream
      
      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE })
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 2048
      analyserRef.current.smoothingTimeConstant = 0.8
      
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      
      // Create script processor for real-time audio processing
      processorRef.current = audioContextRef.current.createScriptProcessor(BUFFER_SIZE, 1, 1)
      
      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        processAudioData(inputData)
      }
      
      // Connect nodes
      microphoneRef.current.connect(analyserRef.current)
      analyserRef.current.connect(processorRef.current)
      processorRef.current.connect(audioContextRef.current.destination)
      
      setIsListening(true)
      setDetectionStatus('listening')
      
      console.log('Wake word detection started')
    } catch (error) {
      console.error('Failed to start wake word detection:', error)
      setDetectionStatus('idle')
    }
  }
  
  const stopListening = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    
    setIsListening(false)
    setDetectionStatus('idle')
    setAudioLevel(0)
    audioBufferRef.current = []
  }
  
  const processAudioData = (audioData: Float32Array) => {
    // Calculate RMS energy
    let sum = 0
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i]
    }
    const rms = Math.sqrt(sum / audioData.length)
    setAudioLevel(Math.min(rms * 5, 1)) // Scale for visualization
    
    // Only process if above silence threshold
    if (rms > SILENCE_THRESHOLD) {
      // Clear silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
        silenceTimeoutRef.current = null
      }
      
      // Add to buffer
      const buffer: AudioBuffer = {
        data: new Float32Array(audioData),
        timestamp: Date.now()
      }
      audioBufferRef.current.push(buffer)
      
      // Remove old buffers (keep last 2 seconds)
      const cutoffTime = Date.now() - 2000
      audioBufferRef.current = audioBufferRef.current.filter(b => b.timestamp > cutoffTime)
      
      // Check for wake word if we have enough audio
      if (audioBufferRef.current.length > 10 && rms > ENERGY_THRESHOLD) {
        checkForWakeWord()
      }
    } else {
      // Set timeout to clear buffer after silence
      if (!silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          audioBufferRef.current = []
        }, 500)
      }
    }
  }
  
  const checkForWakeWord = async () => {
    // Check cooldown
    const now = Date.now()
    if (now - lastDetectionRef.current < DETECTION_COOLDOWN) {
      return
    }
    
    // Get recent audio duration
    const buffers = audioBufferRef.current
    if (buffers.length === 0) return
    
    const duration = buffers[buffers.length - 1].timestamp - buffers[0].timestamp
    
    // Check if we have enough audio for wake word
    if (duration < 500 || duration > WAKE_WORD_DURATION) {
      return
    }
    
    try {
      // Combine audio buffers into a single array
      let totalLength = 0
      buffers.forEach(b => totalLength += b.data.length)
      const combinedAudio = new Float32Array(totalLength)
      let offset = 0
      buffers.forEach(b => {
        combinedAudio.set(b.data, offset)
        offset += b.data.length
      })
      
      // Convert to 16-bit PCM for transcription
      const pcmData = new Int16Array(combinedAudio.length)
      for (let i = 0; i < combinedAudio.length; i++) {
        const s = Math.max(-1, Math.min(1, combinedAudio[i]))
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
      }
      
      // Send to transcription API
      const result = await invoke<{ text: string }>('transcribe_audio', {
        audioData: Array.from(pcmData),
        sampleRate: SAMPLE_RATE
      })
      
      console.log('Transcription result:', result.text)
      
      // Check if transcription contains wake word
      const transcription = result.text.toLowerCase().trim()
      const wakeWord = settings.voice_settings.wake_word.toLowerCase()
      
      if (transcription.includes(wakeWord) || transcription.includes('hey brain') || transcription.includes('brain')) {
        handleWakeWordDetected()
      }
    } catch (error) {
      console.error('Wake word transcription failed:', error)
    }
  }
  
  // Remove the old analyzeAudioPattern function - we're using real transcription now
  
  const handleWakeWordDetected = async () => {
    console.log('Wake word detected!')
    lastDetectionRef.current = Date.now()
    setDetectionStatus('detected')
    
    // Clear buffer
    audioBufferRef.current = []
    
    // Visual/audio feedback
    playDetectionSound()
    
    // Vibrate if available
    if ('vibrate' in navigator) {
      navigator.vibrate(200)
    }
    
    // Stop wake word detection temporarily
    stopListening()
    
    // Start realtime voice session
    try {
      await startVoiceSession({ mode: 'realtime' })
    } catch (error) {
      console.error('Failed to start realtime voice session:', error)
    }
    
    // Reset status after animation
    setTimeout(() => {
      setDetectionStatus('idle')
      // Restart listening if voice is still enabled and no active session
      if (settings.voice_enabled && !isVoiceActive) {
        startListening()
      }
    }, 2000)
  }
  
  const playDetectionSound = () => {
    // Create a pleasant notification sound
    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // Play two ascending notes
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime) // E5
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.1) // A5
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
    
    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.3)
  }
  
  if (!settings.voice_enabled) {
    return null
  }
  
  // Don't show the floating indicator - it's too intrusive
  // The wake word detection will still work in the background
  return null
  
  // Original UI code kept for reference but not rendered:
  /*
  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className={`
        flex items-center space-x-2 px-3 py-2 rounded-full backdrop-blur-sm
        ${detectionStatus === 'listening' ? 'bg-gray-900/80' : ''}
        ${detectionStatus === 'detected' ? 'bg-cyan-600/80 animate-pulse' : ''}
        ${detectionStatus === 'idle' ? 'bg-gray-800/80' : ''}
        transition-all duration-300 shadow-lg
      `}>
        <div className="relative">
          {isListening ? (
            <>
              <Mic className={`w-4 h-4 ${detectionStatus === 'detected' ? 'text-white' : 'text-cyan-400'}`} />
              <div 
                className="absolute inset-0 rounded-full bg-cyan-400/30 animate-ping"
                style={{ 
                  transform: `scale(${1 + audioLevel * 2})`,
                  opacity: audioLevel * 0.5
                }}
              />
            </>
          ) : (
            <MicOff className="w-4 h-4 text-gray-500" />
          )}
        </div>
        <span className="text-xs text-gray-300 font-medium">
          {detectionStatus === 'listening' && `Say "${settings.voice_settings.wake_word}"`}
          {detectionStatus === 'detected' && 'I\'m listening...'}
          {detectionStatus === 'idle' && 'Wake word inactive'}
        </span>
        {detectionStatus === 'listening' && (
          <div className="flex space-x-0.5">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-cyan-400 rounded-full animate-pulse"
                style={{
                  height: `${4 + audioLevel * 12}px`,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
  */
}