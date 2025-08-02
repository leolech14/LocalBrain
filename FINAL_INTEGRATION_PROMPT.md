# LocalBrain Final Integration Prompt

## 🎯 Project Reality Check

Based on comprehensive audits (AUDIT-1 through AUDIT-4), here's what we know:

### Repository Facts
- **GitHub**: https://github.com/leolech14/LocalBrain.git
- **Commits**: Only 3 total (Initial, file deletion feature, voice/terminal/AI merge)
- **Development Command**: `pnpm --filter @localbrain/desktop dev` (starts Vite on port 3001)
- **Package Name**: `@localbrain/desktop` (not `apps/desktop`)

### Verified Infrastructure
✅ **Backend Commands Registered** in `main.rs`:
- Chat: `chat_completion`, `stream_response`
- Terminal: `create_terminal`, `terminal_send_input`, `terminal_resize`
- Voice: `start_voice_session`, `add_audio_chunk`, `stop_voice_session`
- Files: `read_file`, `write_file`, `delete_file`, `read_directory`
- Knowledge: Multiple knowledge management commands
- Settings: `get_settings`, `update_settings`

✅ **Frontend Components with `invoke` calls**:
- `ChatPanel.tsx` - sends messages, handles transcripts
- `TerminalPanel.tsx` - creates sessions, sends input
- `VoiceRecorder.tsx` - manages voice sessions
- `FileExplorerPanel.tsx` - file operations + Git status
- `AgentsCanvas.tsx`, `ContextManager.tsx`, `KnowledgeBaseBrowser.tsx`

### Known Issues
- ❌ No tests exist (`pnpm test` finds nothing)
- ❌ Linting fails (missing `eslint-plugin-react`)
- ❌ Full Tauri integration untested
- ❌ OpenAI integration requires API key configuration

## 🚀 Practical Integration Plan

### Day 1: Verify Core Functionality

#### 1. Fix Development Environment
```bash
# Clone fresh
git clone https://github.com/leolech14/LocalBrain.git
cd LocalBrain

# Install dependencies
pnpm install

# Fix linting
pnpm add -D eslint-plugin-react --filter @localbrain/desktop

# Start development
pnpm --filter @localbrain/desktop tauri:dev
```

#### 2. Test Each Feature Manually
Create a checklist and test in the running app:

```markdown
## Feature Testing Checklist

### Chat
- [ ] Type message in chat → Does it appear?
- [ ] Click send → Does it call OpenAI? (check network/console)
- [ ] If API key missing → Add to settings

### Terminal  
- [ ] Does terminal render?
- [ ] Type `ls` → Does it execute?
- [ ] Check if output appears

### Voice
- [ ] Click microphone → Does it start recording?
- [ ] Speak "Hello" → Stop → Does transcript appear?
- [ ] Does transcript go to chat input?

### Files
- [ ] Does file explorer show files?
- [ ] Click file → Does preview work?
- [ ] Delete file → Does it work?
```

### Day 2-3: Wire Missing Connections

Based on testing results, implement only what's broken:

#### A. If Chat ↔ OpenAI is broken:
```typescript
// In appStore.ts - verify API key is passed
const sendMessage = async (content: string) => {
  const settings = get().settings;
  
  if (!settings.openai_api_key) {
    console.error('OpenAI API key not configured');
    return;
  }
  
  try {
    const response = await invoke('chat_completion', {
      messages: [...get().messages, { role: 'user', content }],
      api_key: settings.openai_api_key // Make sure this is passed
    });
  } catch (e) {
    console.error('Chat failed:', e);
  }
};
```

#### B. If Terminal output isn't showing:
```typescript
// In TerminalPanel.tsx - add output listener
useEffect(() => {
  const unlisten = listen(`terminal_output`, (event) => {
    if (event.payload.session_id === currentSessionId) {
      terminalRef.current?.write(event.payload.data);
    }
  });
  
  return () => { unlisten.then(fn => fn()); };
}, [currentSessionId]);
```

#### C. If Voice → Chat isn't connected:
```typescript
// In VoiceRecorder.tsx - find where transcript is received
useEffect(() => {
  const unlisten = listen('voice-transcript', (event) => {
    // Send to chat input
    appStore.getState().setInput(event.payload.text);
    // Or directly send as message
    appStore.getState().sendMessage(event.payload.text);
  });
  
  return () => { unlisten.then(fn => fn()); };
}, []);
```

### Day 4-5: Add Context Awareness

#### Make Chat aware of Terminal/Files:
```rust
// In commands.rs - enhance chat_completion
#[tauri::command]
pub async fn chat_completion_with_context(
    messages: Vec<ChatMessage>,
    app_state: State<'_, AppStateManager>,
) -> Result<ChatResponse> {
    let mut enriched_messages = messages.clone();
    
    // Get terminal context
    if let Some(terminal_output) = get_recent_terminal_output(&app_state).await {
        enriched_messages.insert(0, ChatMessage {
            role: "system".to_string(),
            content: format!("Recent terminal output:\n{}", terminal_output),
        });
    }
    
    // Get file context
    if let Some(file_content) = get_selected_file_content(&app_state).await {
        enriched_messages.insert(1, ChatMessage {
            role: "system".to_string(),
            content: format!("Selected file content:\n{}", file_content),
        });
    }
    
    // Call OpenAI with enriched context
    chat_completion(enriched_messages, app_state).await
}
```

### Day 6-7: Production Readiness

#### 1. Add Basic Error Handling:
```typescript
// Wrap all invokes
const safeInvoke = async (command: string, args?: any) => {
  try {
    return await invoke(command, args);
  } catch (error) {
    console.error(`Command ${command} failed:`, error);
    toast.error(`Operation failed: ${error}`);
    return null;
  }
};
```

#### 2. Add Loading States:
```typescript
// In components
const [isLoading, setIsLoading] = useState(false);

const handleAction = async () => {
  setIsLoading(true);
  try {
    await safeInvoke('some_command');
  } finally {
    setIsLoading(false);
  }
};
```

#### 3. Persist Settings:
```typescript
// On app start
useEffect(() => {
  const loadSettings = async () => {
    const saved = await invoke('get_settings');
    if (saved) {
      appStore.getState().updateSettings(saved);
    }
  };
  loadSettings();
}, []);
```

## 🎪 Testing Strategy

### 1. Create Integration Tests
```typescript
// tests/integration/chat.test.ts
it('sends chat message with terminal context', async () => {
  // Start app
  // Type in terminal: "echo test"
  // Type in chat: "What did I just run?"
  // Verify response mentions "echo test"
});
```

### 2. Manual Test Script
```bash
#!/bin/bash
# test-features.sh

echo "1. Testing Terminal"
# Type: ls
# Expected: File list appears

echo "2. Testing Voice"
# Click mic, say "Hello world"
# Expected: "Hello world" in chat input

echo "3. Testing Chat"
# Type: "What is 2+2?"
# Expected: "4" response

echo "4. Testing Integration"
# Run terminal command: echo "test data"
# Ask chat: "What's in my terminal?"
# Expected: Response mentions "test data"
```

## 🚨 Common Pitfalls & Solutions

### "Command not found" in frontend
```typescript
// Always check if command exists first
const commands = await invoke('list_commands');
if (!commands.includes('my_command')) {
  console.warn('Command not registered in backend');
}
```

### State not syncing
```typescript
// Use Zustand subscriptions
const unsubscribe = appStore.subscribe(
  (state) => state.messages,
  (messages) => {
    // React to message changes
  }
);
```

### Terminal not showing output
```rust
// Make sure to emit events in Rust
app_handle.emit_all("terminal_output", TerminalOutput {
    session_id: session_id.clone(),
    data: output_string,
})?;
```

## 📋 Success Metrics

### Week 1 Minimum Viable Product
- [ ] Chat works with OpenAI
- [ ] Terminal executes commands
- [ ] Voice transcribes to text
- [ ] Files can be viewed

### Week 2 Integration
- [ ] Chat knows about terminal output
- [ ] Voice input triggers chat
- [ ] Files can be dragged to chat

### Week 3 Polish
- [ ] Settings persist
- [ ] Errors handled gracefully
- [ ] Loading states everywhere
- [ ] Memory usage < 200MB

## 🎮 Quick Start Commands

```bash
# Development
pnpm --filter @localbrain/desktop tauri:dev

# Build
pnpm --filter @localbrain/desktop tauri:build

# Test (after adding tests)
pnpm --filter @localbrain/desktop test

# Lint (after fixing)
pnpm --filter @localbrain/desktop lint
```

## 🔑 Critical Success Factors

1. **Don't rebuild what exists** - Test first, fix only what's broken
2. **OpenAI API key** - Must be configured in settings
3. **Focus on connections** - Backend exists, frontend exists, wire them
4. **Small PRs** - One feature at a time
5. **Test manually first** - Automated tests can come later

Remember: The infrastructure is there. Your job is to connect the dots, not rewrite the app.