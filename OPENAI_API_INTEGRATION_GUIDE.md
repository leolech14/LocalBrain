# OpenAI API Integration Guide for LocalBrain

## Overview

LocalBrain integrates multiple OpenAI APIs to provide a comprehensive voice-activated AI assistant. This guide covers all the APIs, endpoints, authentication, and implementation details.

## 🔑 Authentication

All OpenAI APIs require authentication via API key:

```bash
# Set in environment
export OPENAI_API_KEY="sk-..."

# Or in .env file
OPENAI_API_KEY=sk-...
```

Headers for all requests:
```
Authorization: Bearer YOUR_API_KEY
```

## 📡 APIs Used

### 1. Chat Completions API

**Endpoint**: `https://api.openai.com/v1/chat/completions`

**Purpose**: Text-based conversations and reasoning

**Key Parameters**:
```json
{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7,
  "max_tokens": 4000
}
```

**Models Available**:
- `gpt-4o` - Most capable
- `gpt-4o-mini` - Faster, cheaper
- `o3` - Reasoning model (as requested by user)

### 2. Whisper API (Speech-to-Text)

**Endpoint**: `https://api.openai.com/v1/audio/transcriptions`

**Purpose**: Convert audio to text

**Request Format**: Multipart form data
```bash
curl https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F file="@audio.mp3" \
  -F model="whisper-1"
```

**Supported Formats**: mp3, mp4, mpeg, mpga, m4a, wav, webm

### 3. Text-to-Speech API

**Endpoint**: `https://api.openai.com/v1/audio/speech`

**Purpose**: Convert text to speech

**Request**:
```json
{
  "model": "tts-1",
  "input": "Hello world!",
  "voice": "maple"
}
```

**Available Voices**:
- `alloy`
- `echo`
- `fable`
- `onyx`
- `nova`
- `shimmer`
- `maple` (LocalBrain default)

### 4. Realtime API (WebSocket)

**Endpoint**: `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`

**Purpose**: Low-latency, bidirectional voice conversations with function calling

**Connection Headers**:
```
Authorization: Bearer YOUR_API_KEY
OpenAI-Beta: realtime=v1
```

**Session Configuration**:
```json
{
  "type": "session.update",
  "session": {
    "modalities": ["text", "audio"],
    "voice": "maple",
    "instructions": "You are LocalBrain, a helpful AI assistant...",
    "tools": [
      {
        "type": "function",
        "name": "read_file",
        "description": "Read contents of a file",
        "parameters": {
          "type": "object",
          "properties": {
            "path": {"type": "string"}
          },
          "required": ["path"]
        }
      }
    ],
    "tool_choice": "auto",
    "input_audio_format": "pcm16",
    "output_audio_format": "pcm16",
    "turn_detection": {
      "type": "server_vad",
      "threshold": 0.5,
      "prefix_padding_ms": 300,
      "silence_duration_ms": 500
    }
  }
}
```

## 🎤 Realtime API Event Flow

### Client → Server Events:
- `session.update` - Configure session
- `input_audio_buffer.append` - Send audio chunks
- `input_audio_buffer.commit` - Finalize audio input
- `conversation.item.create` - Add conversation item
- `response.create` - Request response

### Server → Client Events:
- `session.created` - Session initialized
- `conversation.item.created` - New conversation item
- `response.audio.delta` - Audio response chunks
- `response.audio_transcript.delta` - Transcript updates
- `response.function_call_arguments.delta` - Tool call updates
- `response.function_call_arguments.done` - Tool call complete
- `input_audio_buffer.speech_started` - User started speaking
- `input_audio_buffer.speech_stopped` - User stopped speaking
- `error` - Error occurred

## 🔊 Audio Formats

### PCM16 Format (Realtime API):
- Sample Rate: 24000 Hz
- Bit Depth: 16-bit
- Channels: Mono
- Encoding: Linear PCM, little-endian

### Converting Browser Audio:
```javascript
// Float32Array to PCM16
function float32ToPCM16(float32Array) {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = sample * 32767;
  }
  return pcm16;
}
```

## 💰 Pricing

### Chat Completions:
- GPT-4o: $5/1M input, $15/1M output tokens

### Whisper:
- $0.006 per minute

### TTS:
- TTS-1: $15/1M characters

### Realtime API:
- Text: $5/1M input, $20/1M output tokens
- Audio: $100/1M input tokens (~$0.06/min), $200/1M output tokens (~$0.24/min)

## 🚀 Implementation Best Practices

### 1. Connection Management
```javascript
// Reconnection logic
let reconnectAttempts = 0;
const maxReconnects = 5;

async function connectRealtime() {
  try {
    ws = new WebSocket(url);
    reconnectAttempts = 0;
  } catch (error) {
    if (reconnectAttempts < maxReconnects) {
      reconnectAttempts++;
      setTimeout(connectRealtime, 1000 * reconnectAttempts);
    }
  }
}
```

### 2. Error Handling
```javascript
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'error') {
    console.error('Realtime API error:', data.error);
    // Handle specific error codes
    switch (data.error.code) {
      case 'invalid_api_key':
        // Prompt for new API key
        break;
      case 'rate_limit_exceeded':
        // Implement backoff
        break;
    }
  }
});
```

### 3. Audio Streaming
```javascript
// Efficient audio buffering
const audioQueue = [];
let isPlaying = false;

async function playQueuedAudio() {
  if (audioQueue.length === 0 || isPlaying) return;
  
  isPlaying = true;
  while (audioQueue.length > 0) {
    const audioData = audioQueue.shift();
    await playAudio(audioData);
  }
  isPlaying = false;
}
```

### 4. Function Calling
```javascript
// Handle function calls from Realtime API
if (event.type === 'response.function_call_arguments.done') {
  const { call_id, name, arguments } = event;
  const result = await executeFunction(name, JSON.parse(arguments));
  
  // Send result back
  ws.send(JSON.stringify({
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: call_id,
      output: JSON.stringify(result)
    }
  }));
}
```

## 🔒 Security Considerations

1. **API Key Protection**:
   - Never expose API keys in client-side code
   - Use environment variables
   - Implement proxy server for production

2. **Input Validation**:
   - Validate all function parameters
   - Sanitize file paths
   - Limit command execution

3. **Rate Limiting**:
   - Implement client-side rate limiting
   - Monitor usage to avoid unexpected costs
   - Set up usage alerts in OpenAI dashboard

## 📊 Monitoring and Debugging

### Enable Debug Logging:
```javascript
// Log all Realtime API events
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log(`[Realtime] ${data.type}:`, data);
});
```

### Track Performance:
```javascript
const metrics = {
  latency: [],
  errors: [],
  tokensUsed: 0
};

// Measure round-trip time
const startTime = Date.now();
ws.send(JSON.stringify({type: 'response.create'}));
// On response...
metrics.latency.push(Date.now() - startTime);
```

## 🎯 LocalBrain-Specific Implementation

### Wake Word Detection:
- Use Web Audio API for continuous listening
- Detect "Hey Brain" pattern
- Trigger Realtime session on detection

### Sleep Mode:
- Listen for "go to sleep" in transcripts
- Set session to inactive
- Stop processing audio until wake command

### Tool Integration:
- File system access (read/write/list)
- Terminal command execution
- MCP server bridging

### Conversation Logging:
- Stream all messages to chat UI
- Persist conversations to database
- Enable conversation search

## 🆘 Troubleshooting

### Common Issues:

1. **WebSocket Connection Fails**:
   - Check API key validity
   - Verify network connectivity
   - Check OpenAI service status

2. **Audio Not Working**:
   - Verify microphone permissions
   - Check audio format (must be PCM16)
   - Test with simple audio recording first

3. **High Latency**:
   - Consider using WebRTC instead of WebSocket
   - Optimize audio buffer sizes
   - Use closer OpenAI endpoints

4. **Function Calls Not Executing**:
   - Verify tool definitions in session config
   - Check function name matching
   - Validate parameter schemas

## 📚 Additional Resources

- [OpenAI Platform Docs](https://platform.openai.com/docs)
- [Realtime API Reference](https://platform.openai.com/docs/api-reference/realtime)
- [Community Examples](https://github.com/openai/openai-realtime-api-examples)
- [Pricing Calculator](https://openai.com/pricing)

---

This guide covers all OpenAI APIs integrated into LocalBrain. For the latest updates and detailed API references, always refer to the official OpenAI documentation.