import React, { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { ChatView } from './components/chat/ChatView'
import { TerminalView } from './components/terminal/TerminalView'
import { EditorView } from './components/editor/EditorView'
import { FileExplorer } from './components/explorer/FileExplorer'
import { ContextManager } from './components/ContextManager'
import { AgentsCanvas } from './components/AgentsCanvas'
import { ToolkitLibrary } from './components/ToolkitLibrary'
import { KnowledgeBaseBrowser } from './components/KnowledgeBaseBrowser'
import { Settings } from './components/settings/Settings'
import { WakeWordDetector } from './components/voice/WakeWordDetector'
import { RealtimeVoiceSession } from './components/voice/RealtimeVoiceSession'
import { useAppStore } from './stores/appStore'
import './App.css'

const queryClient = new QueryClient()

function App() {
  const { settings, initialize } = useAppStore()
  const darkMode = settings.theme === 'dark'
  
  useEffect(() => {
    initialize()
  }, [initialize])
  
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className={`app ${darkMode ? 'dark' : ''}`}>
          <WakeWordDetector />
          <RealtimeVoiceSession />
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<ChatView />} />
              <Route path="terminal" element={<TerminalView />} />
              <Route path="editor" element={<EditorView />} />
              <Route path="explorer" element={<FileExplorer />} />
              <Route path="context" element={<ContextManager />} />
              <Route path="agents" element={<AgentsCanvas />} />
              <Route path="toolkit" element={<ToolkitLibrary />} />
              <Route path="knowledge" element={<KnowledgeBaseBrowser />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App