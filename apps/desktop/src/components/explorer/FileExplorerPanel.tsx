import React, { useState, useEffect } from 'react'
import { 
  Folder, 
  FolderOpen, 
  File, 
  FileText, 
  FileCode as FileCodeIcon,
  GitBranch,
  Plus,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  Trash2
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../../stores/appStore'

interface FileNode {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  expanded?: boolean
  gitStatus?: GitFileStatus
}

interface GitFileStatus {
  path: string
  status: string
  staged: boolean
  modified: boolean
  deleted: boolean
  new: boolean
  renamed: boolean
  type_changed: boolean
}

interface FileInfo {
  name: string
  path: string
  is_dir: boolean
  size: number
}

export function FileExplorerPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [files, setFiles] = useState<FileNode[]>([])
  const [currentPath, setCurrentPath] = useState('/Users')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [gitStatuses, setGitStatuses] = useState<Map<string, GitFileStatus>>(new Map())
  const { settings, deleteFile } = useAppStore()
  
  useEffect(() => {
    loadDirectory(currentPath)
  }, [currentPath])
  
  useEffect(() => {
    // Load git status for current directory
    loadGitStatus(currentPath)
  }, [currentPath, files])
  
  const loadDirectory = async (path: string) => {
    try {
      const response = await invoke<{success: boolean, data?: FileInfo[], error?: string}>('read_directory', { path })
      
      if (response.success && response.data) {
        const nodes: FileNode[] = response.data.map((file, index) => ({
          id: `${path}-${file.name}-${index}`,
          name: file.name,
          path: file.path,
          type: file.is_dir ? 'folder' : 'file',
          children: file.is_dir ? [] : undefined,
          expanded: false,
        }))
        
        setFiles(nodes.sort((a, b) => {
          // Folders first, then files
          if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        }))
      }
    } catch (error) {
    }
  }
  
  const loadGitStatus = async (path: string) => {
    try {
      const response = await invoke<{success: boolean, data?: GitFileStatus[], error?: string}>('get_git_directory_status', { dirPath: path })
      
      if (response.success && response.data) {
        const statusMap = new Map<string, GitFileStatus>()
        response.data.forEach(status => {
          const fullPath = `${path}/${status.path}`
          statusMap.set(fullPath, status)
        })
        setGitStatuses(statusMap)
      }
    } catch (error) {
      // Not a git repository or other error - that's ok
    }
  }
  
  const loadSubdirectory = async (node: FileNode) => {
    if (node.type !== 'folder' || node.expanded) return
    
    try {
      const response = await invoke<{success: boolean, data?: FileInfo[], error?: string}>('read_directory', { path: node.path })
      
      if (response.success && response.data) {
        const children: FileNode[] = response.data.map((file, index) => ({
          id: `${node.path}-${file.name}-${index}`,
          name: file.name,
          path: file.path,
          type: file.is_dir ? 'folder' : 'file',
          children: file.is_dir ? [] : undefined,
          expanded: false,
        }))
        
        // Update the node with children
        const updateNode = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(n => {
            if (n.id === node.id) {
              return { 
                ...n, 
                children: children.sort((a, b) => {
                  if (a.type !== b.type) {
                    return a.type === 'folder' ? -1 : 1
                  }
                  return a.name.localeCompare(b.name)
                }),
                expanded: true 
              }
            }
            if (n.children) {
              return { ...n, children: updateNode(n.children) }
            }
            return n
          })
        }
        
        setFiles(updateNode(files))
        
        // Load git status for subdirectory
        await loadGitStatus(node.path)
      }
    } catch (error) {
    }
  }
  
  const toggleFolder = async (node: FileNode) => {
    if (!node.expanded && node.children?.length === 0) {
      await loadSubdirectory(node)
    } else {
      // Just toggle expansion
      const toggleNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(n => {
          if (n.id === node.id) {
            return { ...n, expanded: !n.expanded }
          }
          if (n.children) {
            return { ...n, children: toggleNode(n.children) }
          }
          return n
        })
      }
      
      setFiles(toggleNode(files))
    }
  }
  
  const handleFileClick = async (node: FileNode) => {
    if (node.type === 'folder') {
      await toggleFolder(node)
    } else {
      setSelectedFile(node.path)
      // Emit file selected event or open in editor
      window.dispatchEvent(new CustomEvent('file-selected', { detail: node.path }))
    }
  }
  
  const getFileIcon = (node: FileNode) => {
    if (node.type === 'folder') {
      return node.expanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />
    }
    
    if (node.name.endsWith('.tsx') || node.name.endsWith('.ts') || node.name.endsWith('.jsx') || node.name.endsWith('.js')) {
      return <FileCodeIcon className="w-4 h-4 text-gray-400" />
    }
    if (node.name.endsWith('.md')) {
      return <FileText className="w-4 h-4 text-gray-400" />
    }
    
    return <File className="w-4 h-4" />
  }
  
  const getGitStatusColor = (node: FileNode) => {
    const status = gitStatuses.get(node.path)
    if (!status) return ''
    
    if (status.deleted) return 'text-red-500'
    if (status.new) return 'text-green-500'
    if (status.modified) return 'text-yellow-500'
    if (status.renamed) return 'text-gray-400'
    
    return ''
  }
  
  const getGitStatusIndicator = (node: FileNode) => {
    const status = gitStatuses.get(node.path)
    if (!status) return null
    
    let indicator = ''
    if (status.new) indicator = 'A'
    else if (status.modified) indicator = 'M'
    else if (status.deleted) indicator = 'D'
    else if (status.renamed) indicator = 'R'
    
    if (!indicator) return null
    
    return (
      <span className={`ml-1 text-xs font-bold ${getGitStatusColor(node)}`}>
        {indicator}
      </span>
    )
  }
  
  const renderFileTree = (nodes: FileNode[], level = 0) => {
    const filteredNodes = nodes.filter(node => 
      node.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    return filteredNodes.map(node => (
      <div key={node.id}>
        <div
          className={`flex items-center px-2 py-1 hover:bg-black cursor-pointer transition-colors ${
            selectedFile === node.path ? 'bg-black' : ''
          }`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => handleFileClick(node)}
        >
          {node.type === 'folder' && (
            <div className="mr-1">
              {node.expanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </div>
          )}
          <div className={`mr-2 ${getGitStatusColor(node)}`}>
            {getFileIcon(node)}
          </div>
          <span className={`text-sm flex-1 ${getGitStatusColor(node)}`}>
            {node.name}
          </span>
          {getGitStatusIndicator(node)}
        </div>
        {node.expanded && node.children && (
          renderFileTree(node.children, level + 1)
        )}
      </div>
    ))
  }
  
  const navigateUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/')
    if (parent && settings.allowed_roots.some(root => parent.startsWith(root))) {
      setCurrentPath(parent)
    }
  }
  
  const refresh = () => {
    loadDirectory(currentPath)
    loadGitStatus(currentPath)
  }

  const handleDeleteSelected = async () => {
    if (!selectedFile) return
    if (confirm(`Delete ${selectedFile}?`)) {
      try {
        await deleteFile(selectedFile)
        setSelectedFile(null)
        await loadDirectory(currentPath)
        await loadGitStatus(currentPath)
      } catch (error) {
      }
    }
  }
  
  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-900">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Explorer</h3>
            <div className="flex items-center space-x-1">
              <button
                onClick={refresh}
                className="p-1 hover:bg-black rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {selectedFile && (
                <button
                  onClick={handleDeleteSelected}
                  className="p-1 hover:bg-black rounded transition-colors"
                  title="Delete File"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                className="p-1 hover:bg-black rounded transition-colors"
                title="New File"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2 py-1 bg-black text-sm rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
        </div>
        
        {/* Current Path */}
        <div className="mt-2 text-xs text-gray-500 truncate">
          {currentPath}
        </div>
      </div>
      
      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        {currentPath !== '/' && settings.allowed_roots.some(root => currentPath.startsWith(root)) && (
          <div
            className="flex items-center px-2 py-1 hover:bg-gray-900 cursor-pointer transition-colors"
            onClick={navigateUp}
          >
            <Folder className="w-4 h-4 mr-2" />
            <span className="text-sm">..</span>
          </div>
        )}
        {renderFileTree(files)}
      </div>
      
      {/* Git Status Bar */}
      <div className="px-3 py-2 border-t border-gray-800 flex items-center space-x-2">
        <GitBranch className="w-4 h-4 text-gray-500" />
        <span className="text-xs text-gray-500">Git status active</span>
      </div>
    </div>
  )
}