import React, { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { FileCode, Save, Play, X } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

interface EditorTab {
  id: string
  name: string
  content: string
  language: string
  path?: string
  isDirty?: boolean
}

export function EditorPanel() {
  const [tabs, setTabs] = useState<EditorTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  
  useEffect(() => {
    // Listen for file selection events
    const handleFileSelected = async (event: CustomEvent) => {
      const filePath = event.detail
      await openFile(filePath)
    }
    
    window.addEventListener('file-selected', handleFileSelected as any)
    
    return () => {
      window.removeEventListener('file-selected', handleFileSelected as any)
    }
  }, [tabs])
  
  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'js': return 'javascript'
      case 'jsx': return 'javascript'
      case 'ts': return 'typescript'
      case 'tsx': return 'typescript'
      case 'py': return 'python'
      case 'rs': return 'rust'
      case 'go': return 'go'
      case 'java': return 'java'
      case 'cpp':
      case 'cc':
      case 'cxx': return 'cpp'
      case 'c': return 'c'
      case 'h': return 'c'
      case 'cs': return 'csharp'
      case 'php': return 'php'
      case 'rb': return 'ruby'
      case 'swift': return 'swift'
      case 'kt': return 'kotlin'
      case 'r': return 'r'
      case 'sql': return 'sql'
      case 'sh':
      case 'bash': return 'shell'
      case 'yaml':
      case 'yml': return 'yaml'
      case 'json': return 'json'
      case 'xml': return 'xml'
      case 'html': return 'html'
      case 'css': return 'css'
      case 'scss': return 'scss'
      case 'less': return 'less'
      case 'md': return 'markdown'
      case 'toml': return 'toml'
      default: return 'plaintext'
    }
  }
  
  const openFile = async (filePath: string) => {
    // Check if file is already open
    const existingTab = tabs.find(tab => tab.path === filePath)
    if (existingTab) {
      setActiveTabId(existingTab.id)
      return
    }
    
    try {
      const response = await invoke<{success: boolean, data?: string, error?: string}>('read_file', { path: filePath })
      
      if (response.success && response.data !== undefined) {
        const fileName = filePath.split('/').pop() || 'untitled'
        const newTab: EditorTab = {
          id: Date.now().toString(),
          name: fileName,
          path: filePath,
          content: response.data,
          language: getLanguageFromPath(filePath),
          isDirty: false,
        }
        
        setTabs([...tabs, newTab])
        setActiveTabId(newTab.id)
      } else {
      }
    } catch (error) {
    }
  }
  
  const activeTab = tabs.find(tab => tab.id === activeTabId)
  
  const handleEditorChange = (value: string | undefined) => {
    if (!value || !activeTab) return
    
    setTabs(tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, content: value, isDirty: true }
        : tab
    ))
  }
  
  const closeTab = (id: string) => {
    const tab = tabs.find(t => t.id === id)
    if (tab?.isDirty) {
      // Use native confirm for now - could be replaced with a custom dialog
      if (!confirm(`"${tab.name}" has unsaved changes. Close anyway?`)) {
        return
      }
    }
    
    const newTabs = tabs.filter(tab => tab.id !== id)
    setTabs(newTabs)
    
    if (activeTabId === id && newTabs.length > 0) {
      setActiveTabId(newTabs[0].id)
    } else if (newTabs.length === 0) {
      setActiveTabId('')
    }
  }
  
  const saveFile = async () => {
    if (!activeTab || !activeTab.path) return
    
    try {
      const response = await invoke<{success: boolean, error?: string}>('write_file', {
        path: activeTab.path,
        content: activeTab.content
      })
      
      if (response.success) {
        setTabs(tabs.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, isDirty: false }
            : tab
        ))
        // File saved successfully
      } else {
      }
    } catch (error) {
    }
  }
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveFile()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab])
  
  if (tabs.length === 0) {
    return (
      <div className="flex flex-col h-full bg-black items-center justify-center">
        <FileCode className="w-16 h-16 text-gray-700 mb-1" />
        <h3 className="text-sm font-medium text-gray-400 mb-2">No files open</h3>
        <p className="text-sm text-gray-500">Open a file from the Explorer to start editing</p>
      </div>
    )
  }
  
  return (
    <div className="flex flex-col h-full bg-black">
      {/* Tabs */}
      <div className="flex items-center bg-black border-b border-gray-900 px-2 py-1 space-x-1 overflow-x-auto">
        <FileCode className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" />
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center px-3 py-1 rounded-t-lg cursor-pointer transition-colors flex-shrink-0 ${
              activeTabId === tab.id
                ? 'bg-black text-gray-100'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
            onClick={() => setActiveTabId(tab.id)}
          >
            <span className="text-sm">
              {tab.isDirty && <span className="mr-1">•</span>}
              {tab.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
              className="ml-2 hover:text-red-400 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-2 bg-black border-b border-gray-900">
        <div className="text-sm text-gray-400 truncate">
          {activeTab?.path || activeTab?.name}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={saveFile}
            className="p-1 hover:bg-black rounded transition-colors"
            title="Save (Cmd+S)"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            className="p-1 hover:bg-black rounded transition-colors"
            title="Run"
          >
            <Play className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Editor */}
      <div className="flex-1">
        {activeTab && (
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            onChange={handleEditorChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              tabSize: 2,
              insertSpaces: true,
              detectIndentation: true,
              folding: true,
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
              },
            }}
          />
        )}
      </div>
    </div>
  )
}