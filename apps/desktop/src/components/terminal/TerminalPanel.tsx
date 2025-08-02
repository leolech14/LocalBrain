import React, { useEffect, useRef, useState } from 'react'
import { Terminal as TerminalIcon, Plus, X } from 'lucide-react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useAppStore } from '../../stores/appStore'
import 'xterm/css/xterm.css'

interface Tab {
  id: string
  name: string
  sessionId: string
}

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  const terminalsRef = useRef<Map<string, Terminal>>(new Map())
  const fitAddonsRef = useRef<Map<string, FitAddon>>(new Map())
  const unlistenersRef = useRef<Map<string, () => void>>(new Map())
  const appendTerminalOutput = useAppStore(state => state.appendTerminalOutput)
  const initializedRef = useRef(false)
  
  useEffect(() => {
    // Create initial terminal tab only once
    if (!initializedRef.current) {
      initializedRef.current = true
      // Use setTimeout to ensure this only runs once even in StrictMode
      const timer = setTimeout(() => {
        if (tabs.length === 0) {
          createNewTab()
        }
      }, 0)
      
      return () => {
        clearTimeout(timer)
        // Cleanup all terminals and listeners
        unlistenersRef.current.forEach(unlisten => unlisten())
        terminalsRef.current.forEach(terminal => terminal.dispose())
      }
    }
  }, [])
  
  useEffect(() => {
    // Mount active terminal
    if (activeTabId && terminalRef.current) {
      const activeTab = tabs.find(tab => tab.id === activeTabId)
      if (!activeTab) return
      
      let terminal = terminalsRef.current.get(activeTabId)
      
      if (!terminal) {
        // Create new terminal instance
        terminal = new Terminal({
          theme: {
            background: '#000000',
            foreground: '#f3f4f6',
            cursor: '#60a5fa',
            selectionBackground: '#3b82f680',
          },
          fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
          fontSize: 11,
          cursorBlink: true,
        })
        
        terminalsRef.current.set(activeTabId, terminal)
        
        // Setup terminal
        terminal.open(terminalRef.current)
        
        const fitAddon = new FitAddon()
        terminal.loadAddon(fitAddon)
        terminal.loadAddon(new WebLinksAddon())
        
        // Important: fit after the terminal is attached to DOM
        setTimeout(() => {
          fitAddon.fit()
          // Test write to verify terminal is working
          if (terminal) {
            terminal.write('Terminal initialized...\r\n')
          }
        }, 100)
        
        fitAddonsRef.current.set(activeTabId, fitAddon)
        
        // Handle terminal input
        terminal.onData(async (data) => {
          console.log('Sending terminal input:', data, 'to session:', activeTab.sessionId)
          try {
            await invoke('terminal_send_input', {
              sessionId: activeTab.sessionId,
              input: data
            })
          } catch (error) {
            console.error('Failed to send terminal input:', error)
          }
        })
        
        // Listen for terminal output - using async/await for better error handling
        const setupListener = async () => {
          try {
            console.log('Setting up listener for:', `terminal-output-${activeTab.sessionId}`)
            const unlisten = await listen<string>(`terminal-output-${activeTab.sessionId}`, (event) => {
              console.log('Received terminal output:', event.payload)
              if (terminal) {
                terminal.write(event.payload)
              }
              appendTerminalOutput(event.payload)
            })
            
            console.log('Listener setup complete')
            unlistenersRef.current.set(activeTabId, unlisten)
          } catch (err) {
            console.error('Failed to setup listener:', err)
          }
        }
        
        setupListener()
        
        // Handle resize
        const handleResize = () => {
          fitAddon.fit()
          const dimensions = fitAddon.proposeDimensions()
          if (dimensions) {
            invoke('terminal_resize', {
              sessionId: activeTab.sessionId,
              cols: dimensions.cols,
              rows: dimensions.rows
            })
          }
        }
        window.addEventListener('resize', handleResize)
        
        // Store cleanup function
        const cleanup = () => {
          window.removeEventListener('resize', handleResize)
          const unlisten = unlistenersRef.current.get(activeTabId)
          if (unlisten) {
            unlisten()
            unlistenersRef.current.delete(activeTabId)
          }
          fitAddonsRef.current.delete(activeTabId)
        }
        
        // Replace any existing cleanup
        const existingCleanup = (terminal as any).__cleanup
        if (existingCleanup) existingCleanup()
        ;(terminal as any).__cleanup = cleanup
      } else {
        // Re-attach existing terminal
        terminal.open(terminalRef.current)
        const fitAddon = fitAddonsRef.current.get(activeTabId)
        if (fitAddon) {
          fitAddon.fit()
        }
      }
    }
    
    // Hide other terminals
    terminalsRef.current.forEach((terminal, id) => {
      if (id !== activeTabId && terminal.element) {
        terminal.element.style.display = 'none'
      }
    })
    
    // Show active terminal
    const activeTerminal = terminalsRef.current.get(activeTabId)
    if (activeTerminal && activeTerminal.element) {
      activeTerminal.element.style.display = 'block'
    }
  }, [activeTabId, tabs])
  
  const createNewTab = async () => {
    console.log('createNewTab called, current tabs:', tabs.length)
    try {
      // Create backend terminal session
      const response = await invoke<{
        success: boolean,
        data?: string,
        error?: string
      }>('create_terminal', {
        config: {
          shell: '/bin/zsh',
          workingDir: '/Users/lech/LocalBrain_v0.1'
        }
      })
      
      console.log('Create terminal response:', response)
      
      if (!response.success || !response.data) {
        console.error('Failed to create terminal:', response.error)
        return
      }
      
      const sessionId = response.data
      console.log('Terminal session ID:', sessionId)
      const id = Date.now().toString()
      
      const newTab: Tab = {
        id,
        name: `Terminal ${tabs.length + 1}`,
        sessionId,
      }
      
      setTabs([...tabs, newTab])
      setActiveTabId(id)
    } catch (error) {
      console.error('Failed to create terminal:', error)
    }
  }
  
  const closeTab = async (id: string) => {
    const tab = tabs.find(t => t.id === id)
    if (!tab) return
    
    // Close backend session
    try {
      await invoke('close_terminal', { terminalId: tab.sessionId })
    } catch (error) {
      console.error('Failed to close terminal:', error)
    }
    
    // Cleanup terminal
    const terminal = terminalsRef.current.get(id)
    if (terminal) {
      const cleanup = (terminal as any).__cleanup
      if (cleanup) cleanup()
      terminal.dispose()
      terminalsRef.current.delete(id)
    }
    
    const newTabs = tabs.filter(tab => tab.id !== id)
    setTabs(newTabs)
    
    if (activeTabId === id && newTabs.length > 0) {
      setActiveTabId(newTabs[0].id)
    } else if (newTabs.length === 0) {
      // Create a new tab if all are closed
      createNewTab()
    }
  }
  
  return (
    <div className="flex flex-col h-full bg-black">
      {/* Tabs */}
      <div className="flex items-center bg-black border-b border-gray-900 px-1 py-0.5 space-x-0.5">
        <TerminalIcon className="w-3 h-3 text-gray-500 mr-1" />
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center px-2 py-0.5 rounded-t cursor-pointer transition-colors ${
              activeTabId === tab.id
                ? 'bg-black text-gray-100'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
            onClick={() => setActiveTabId(tab.id)}
          >
            <span className="text-xs">{tab.name}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
                className="ml-1 hover:text-red-400 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={createNewTab}
          className="p-0.5 hover:bg-black rounded transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      
      {/* Terminal Content */}
      <div className="flex-1 bg-black">
        <div ref={terminalRef} className="h-full" />
      </div>
    </div>
  )
}
