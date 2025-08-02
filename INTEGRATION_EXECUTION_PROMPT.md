# LocalBrain Integration Execution Plan

## Repository
**GitHub**: https://github.com/leolech14/LocalBrain.git

## Current State Assessment
The codebase already has substantial infrastructure in place:
- ✅ **VoiceManager**: Session lifecycle, OpenAI Whisper transcription ready
- ✅ **TerminalManager**: PTY sessions with create, write, resize capabilities  
- ✅ **Chat Integration**: `chat_completion` command with OpenAI API
- ✅ **File Operations**: Read/write/list methods with security checks
- ✅ **State Management**: Zustand store with proper action structure
- ✅ **UI Components**: All major panels built with ultra-compact design

## Week 1 Sprint: Core Integration (Highest Priority)

### 1. Wire OpenAI Chat with Context (2 days)
**File**: `apps/desktop/src-tauri/src/commands.rs`
```rust
// Enhance chat_completion to accept context
#[tauri::command]
pub async fn chat_completion(
    messages: Vec<ChatMessage>,
    terminal_context: Option<String>,  // Last N lines from terminal
    file_context: Option<Vec<FileContext>>,  // Dragged files
    app_state: State<'_, AppStateManager>,
) -> Result<ChatResponse> {
    // Merge contexts into system message
    // Call OpenAI with enriched prompt
}
```

**File**: `apps/desktop/src/stores/appStore.ts`
```typescript
// Before sending message, gather context
const sendMessage = async (content: string) => {
  const terminalContext = await getActiveTerminalBuffer();
  const fileContext = get().draggedFiles;
  
  const response = await invoke('chat_completion', {
    messages: [...get().messages, { role: 'user', content }],
    terminal_context: terminalContext,
    file_context: fileContext
  });
  
  // Handle streaming response
}
```

### 2. Complete Terminal ↔ PTY Bridge (2 days)
**File**: `apps/desktop/src-tauri/src/main.rs`
```rust
// Initialize TerminalManager at startup
let terminal_manager = TerminalManager::new();

// Register missing commands
.invoke_handler(tauri::generate_handler![
    create_terminal_session,
    write_to_terminal,
    resize_terminal,
    read_terminal_output,
    list_terminal_sessions,
])
```

**File**: `apps/desktop/src/components/terminal/TerminalView.tsx`
```typescript
// Complete the terminal integration
useEffect(() => {
  const sessionId = await invoke('create_terminal_session', { 
    shell: settings.terminal_settings.shell 
  });
  
  // Set up output listener
  const unlisten = await listen(`terminal-output-${sessionId}`, (event) => {
    terminalRef.current?.write(event.payload as string);
  });
  
  // Wire up xterm.js data handler
  terminalRef.current?.onData((data) => {
    invoke('write_to_terminal', { session_id: sessionId, data });
  });
}, []);
```

### 3. Expose File System Commands (1 day)
**File**: `apps/desktop/src-tauri/src/commands.rs`
```rust
#[tauri::command]
pub async fn read_file(
    path: String,
    app_state: State<'_, AppStateManager>,
) -> Result<FileContent> {
    // Check allowed_roots
    let settings = app_state.settings.read().await;
    if !is_path_allowed(&path, &settings.allowed_roots) {
        return Err("Access denied: Path not in allowed roots".into());
    }
    
    // Read and return file
    FileOperations::read(&path).await
}

// Similar for write_file, list_directory, etc.
```

## Week 2 Sprint: Voice Integration

### 4. Wake Word Detection (2 days)
**File**: `apps/desktop/src/components/voice/WakeWordDetector.tsx`
```typescript
const detectWakeWord = (audioData: Float32Array): boolean => {
  // Simple energy-based detection for "Hey Brain"
  // Can upgrade to Porcupine or similar later
  const energy = calculateRMS(audioData);
  
  if (energy > threshold && !isListening) {
    // Check for "Hey Brain" pattern
    invoke('start_voice_session');
    return true;
  }
  return false;
};
```

### 5. Complete Voice Pipeline (2 days)
**File**: `apps/desktop/src/components/voice/VoiceRecorder.tsx`
```typescript
// Connect recording → Whisper → Chat
const handleRecordingComplete = async (audioBlob: Blob) => {
  const audioData = await audioBlob.arrayBuffer();
  
  // Send to Whisper via Tauri
  const transcript = await invoke('transcribe_audio', {
    audio_data: Array.from(new Uint8Array(audioData))
  });
  
  // Inject into chat
  appStore.getState().sendMessage(transcript);
};
```

### 6. TTS Integration (1 day)
```typescript
// Auto-speak AI responses
useEffect(() => {
  if (lastMessage?.role === 'assistant' && settings.voice_settings.auto_speak) {
    invoke('speak_text', { text: lastMessage.content });
  }
}, [messages]);
```

## Week 3 Sprint: State & Security

### 7. SQLCipher Persistence (2 days)
**File**: `apps/desktop/src-tauri/src/database.rs`
```rust
// Add session snapshot methods
impl Database {
    pub async fn save_app_state(&self, state: &AppSnapshot) -> Result<()> {
        // Serialize terminal sessions, chat history, etc.
        sqlx::query!(
            "INSERT OR REPLACE INTO app_state (id, data) VALUES (1, ?)",
            serde_json::to_string(&state)?
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
```

### 8. Security Implementation (2 days)
```rust
// Confirmation prompts for dangerous commands
#[tauri::command]
pub async fn execute_terminal_command(
    session_id: String,
    command: String,
    app_state: State<'_, AppStateManager>,
) -> Result<()> {
    let settings = app_state.settings.read().await;
    
    if settings.security_settings.require_confirmation {
        if is_dangerous_command(&command) {
            // Emit event for frontend confirmation dialog
            app_state.app_handle.emit_all("confirm-command", &command)?;
            return Ok(()); // Wait for confirmation
        }
    }
    
    // Execute if safe
    terminal_manager.write_to_session(&session_id, &command).await
}
```

## Week 4 Sprint: Production

### 9. Build Pipeline (2 days)
```toml
# Tauri.conf.json
{
  "bundle": {
    "identifier": "com.localbrain.app",
    "icon": ["icons/icon.icns"],
    "macOS": {
      "entitlements": "./entitlements.plist",
      "hardenedRuntime": true,
      "signingIdentity": "Developer ID Application"
    }
  }
}
```

### 10. Testing Suite (3 days)
```rust
// Rust unit tests
#[tokio::test]
async fn test_terminal_session_lifecycle() {
    let manager = TerminalManager::new();
    let session = manager.create_session("zsh").await.unwrap();
    assert!(manager.get_session(&session.id).await.is_ok());
    
    manager.write_to_session(&session.id, "echo test\n").await.unwrap();
    // Verify output
}
```

```typescript
// React component tests
describe('ChatPanel', () => {
  it('sends message with context', async () => {
    const { user } = render(<ChatPanel />);
    
    // Mock terminal context
    vi.mocked(invoke).mockResolvedValueOnce('terminal output');
    
    await user.type(screen.getByRole('textbox'), 'Hello');
    await user.keyboard('{Enter}');
    
    expect(invoke).toHaveBeenCalledWith('chat_completion', 
      expect.objectContaining({
        terminal_context: 'terminal output'
      })
    );
  });
});
```

## Critical Integration Points

### 1. Event System
```typescript
// Frontend listening for backend events
listen('terminal-output', ({ payload }) => {
  updateTerminalBuffer(payload);
});

listen('voice-transcript', ({ payload }) => {
  appendToChat(payload);
});

listen('confirm-command', ({ payload }) => {
  showConfirmationDialog(payload);
});
```

### 2. Error Handling
```rust
// Wrap all commands with proper error handling
#[tauri::command]
pub async fn any_command() -> Result<Response, CommandError> {
    match actual_operation().await {
        Ok(result) => Ok(result),
        Err(e) => {
            log_error(&e);
            Err(CommandError::from(e))
        }
    }
}
```

### 3. Performance Optimizations
- Stream large files in chunks
- Debounce terminal output events  
- Lazy load file explorer items
- Use virtual scrolling for chat history

## Success Metrics
- [ ] Chat responds with awareness of terminal context
- [ ] Voice commands execute end-to-end in < 3 seconds
- [ ] Terminal sessions persist across restarts
- [ ] File operations respect security boundaries
- [ ] Memory usage stays under 200MB
- [ ] App launches in < 2 seconds
- [ ] No data loss on crash

## Immediate Next Steps
1. Clone repo and run `pnpm install`
2. Start with Week 1, Task 1 (Context-aware chat)
3. Test each integration point before moving on
4. Keep PR sizes small and focused

This plan leverages the existing infrastructure and focuses on connecting the dots rather than building from scratch.