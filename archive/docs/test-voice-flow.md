# LocalBrain Voice Conversation Test Plan

## Prerequisites
1. Ensure LocalBrain is built and running
2. Have a valid OpenAI API key configured
3. Have microphone permissions granted

## Test Flow

### 1. Wake Word Detection
- [ ] Start LocalBrain application
- [ ] Verify wake word detector indicator appears (bottom left)
- [ ] Say "Hey Brain!" clearly
- [ ] Verify detection animation triggers
- [ ] Verify realtime voice session starts

### 2. Continuous Conversation
- [ ] Once session starts, verify "Listening" status
- [ ] Say: "Can you list the files in my home directory?"
- [ ] Verify:
  - Speech is transcribed
  - Tool execution occurs (file listing)
  - Response is spoken back
  - Result appears in chat window

### 3. Tool Execution Tests
- [ ] Test file reading: "Read the contents of README.md"
- [ ] Test file writing: "Create a test file called hello.txt with 'Hello World' content"
- [ ] Test terminal command: "What's the current date and time?"
- [ ] Verify all commands execute and results are shown

### 4. Sleep Mode
- [ ] Say: "Go to sleep"
- [ ] Verify:
  - Session enters sleep mode
  - "Sleeping" status is shown
  - Wake up button appears

### 5. Wake from Sleep
- [ ] Click "Wake Up" button OR say "Hey Brain!"
- [ ] Verify session resumes
- [ ] Continue conversation

### 6. End Session
- [ ] Click "End" button in voice panel
- [ ] Verify session closes cleanly
- [ ] Verify wake word detector resumes

## Expected Behaviors

1. **Audio Streaming**: Bidirectional audio should work smoothly
2. **Tool Access**: LLM should successfully execute file and terminal operations
3. **Chat Logging**: All conversations should appear in the chat window
4. **State Management**: Session states should transition correctly
5. **Error Handling**: Network errors should be gracefully handled

## Known Limitations

1. MCP Bridge Tool is not fully implemented (placeholder only)
2. Local whisper.cpp and Piper TTS fallbacks not yet implemented
3. Voice activity detection relies on OpenAI's server-side VAD

## Debug Commands

If issues occur, check:
```bash
# Check Tauri logs
tail -f ~/Library/Logs/LocalBrain/app.log

# Check browser console for frontend errors
# Open DevTools in the app window

# Verify API key is set
echo $OPENAI_API_KEY
```