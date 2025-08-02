import React, { useState, useEffect } from 'react';
import { Save, Trash2, Plus, Search, Upload, Download, FolderOpen, Clock } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ApiResponse } from '../types';

interface ChatContext {
  id: string;
  name: string;
  context_type: string;
  data: any;
  created_at: string;
  updated_at: string;
}

export const ContextManager: React.FC = () => {
  const [contexts, setContexts] = useState<ChatContext[]>([]);
  const [selectedContext, setSelectedContext] = useState<ChatContext | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [newContextName, setNewContextName] = useState('');
  const [newContextType, setNewContextType] = useState('prompt');
  const [newContextContent, setNewContextContent] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(192); // w-48 = 192px

  useEffect(() => {
    loadContexts();
  }, [filterType]);

  const loadContexts = async () => {
    try {
      const response = await invoke<ApiResponse<ChatContext[]>>('list_contexts', {
        contextType: filterType === 'all' ? null : filterType
      });
      if (response.success && response.data) {
        setContexts(response.data);
      }
    } catch (error) {
    }
  };

  const saveContext = async () => {
    if (!newContextName || !newContextContent) return;

    try {
      const id = `ctx_${Date.now()}`;
      await invoke<ApiResponse<void>>('save_context', {
        id,
        name: newContextName,
        content: newContextContent,
        contextType: newContextType
      });
      
      setIsCreating(false);
      setNewContextName('');
      setNewContextContent('');
      await loadContexts();
    } catch (error) {
    }
  };

  const loadContext = async (id: string) => {
    try {
      const response = await invoke<ApiResponse<ChatContext>>('load_context', { id });
      if (response.success && response.data) {
        setSelectedContext(response.data);
      }
    } catch (error) {
    }
  };

  const deleteContext = async (id: string) => {
    if (!confirm('Are you sure you want to delete this context?')) return;
    
    try {
      await invoke<ApiResponse<void>>('delete_context', { id });
      if (selectedContext?.id === id) {
        setSelectedContext(null);
      }
      await loadContexts();
    } catch (error) {
    }
  };

  const filteredContexts = contexts.filter(ctx => 
    ctx.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const contextTypes = [
    { value: 'all', label: 'All Types', icon: FolderOpen },
    { value: 'prompt', label: 'Prompts', icon: Save },
    { value: 'agent', label: 'Agents', icon: Save },
    { value: 'knowledge', label: 'Knowledge', icon: Save },
  ];

  return (
    <div className="flex h-full bg-black">
      {/* Sidebar */}
      <div 
        className="bg-black border-r border-gray-900 flex flex-col relative"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="p-2 border-b border-gray-900">
          <h2 className="text-xs font-semibold text-white mb-1">Context Manager</h2>
          
          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
            <input
              type="text"
              placeholder="Search contexts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-1 py-0.5 text-xs bg-black text-white rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>

          {/* Filter by type */}
          <div className="flex gap-1 mb-2">
            {contextTypes.map(type => (
              <button
                key={type.value}
                onClick={() => setFilterType(type.value)}
                className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterType === type.value
                    ? 'bg-black text-white'
                    : 'bg-black text-gray-300 hover:bg-gray-900'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* New Context Button */}
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center justify-center gap-1 px-2 py-0.5 text-xs bg-black text-white rounded hover:bg-gray-900 transition-colors"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
        </div>

        {/* Context List */}
        <div className="flex-1 overflow-y-auto p-1">
          {filteredContexts.map(context => (
            <div
              key={context.id}
              onClick={() => loadContext(context.id)}
              className={`p-1.5 mb-0.5 rounded cursor-pointer transition-colors ${
                selectedContext?.id === context.id
                  ? 'bg-black text-white'
                  : 'bg-black text-gray-300 hover:bg-gray-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-xs">{context.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-1 bg-gray-900 rounded">
                      {context.context_type}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(context.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteContext(context.id);
                  }}
                  className="p-0.5 hover:bg-gray-900 rounded"
                >
                  <Trash2 className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resize Handle */}
      <div
        className="w-1 bg-gray-900 hover:bg-gray-700 cursor-col-resize transition-colors"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.pageX;
          const startWidth = sidebarWidth;
          
          const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(150, Math.min(400, startWidth + e.pageX - startX));
            setSidebarWidth(newWidth);
          };
          
          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {isCreating ? (
          /* Create New Context */
          <div className="flex-1 p-2">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xs font-semibold text-white mb-1">Create New Context</h2>
              
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Context Name
                  </label>
                  <input
                    type="text"
                    value={newContextName}
                    onChange={(e) => setNewContextName(e.target.value)}
                    placeholder="Enter context name..."
                    className="w-full px-2 py-0.5 text-xs bg-black text-white rounded border border-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Context Type
                  </label>
                  <select
                    value={newContextType}
                    onChange={(e) => setNewContextType(e.target.value)}
                    className="w-full px-2 py-0.5 text-xs bg-black text-white rounded border border-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  >
                    <option value="prompt">Prompt</option>
                    <option value="agent">Agent</option>
                    <option value="knowledge">Knowledge</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Content
                  </label>
                  <textarea
                    value={newContextContent}
                    onChange={(e) => setNewContextContent(e.target.value)}
                    placeholder="Enter context content..."
                    rows={8}
                    className="w-full px-2 py-0.5 text-xs bg-black text-white rounded border border-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500 font-mono"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={saveContext}
                    className="px-2 py-0.5 text-xs bg-black text-white rounded hover:bg-gray-900 transition-colors flex items-center gap-1"
                  >
                    <Save className="w-3 h-3" />
                    Save Context
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setNewContextName('');
                      setNewContextContent('');
                    }}
                    className="px-2 py-0.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : selectedContext ? (
          /* View/Edit Context */
          <div className="flex-1 p-2">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-xs font-semibold text-white">{selectedContext.name}</h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs px-1.5 py-0 bg-gray-900 rounded text-gray-300">
                      {selectedContext.context_type}
                    </span>
                    <span className="text-xs text-gray-400">
                      Updated: {new Date(selectedContext.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-1 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors">
                    <Upload className="w-3 h-3" />
                  </button>
                  <button className="p-1 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors">
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="bg-black rounded p-2 border border-gray-700">
                <pre className="text-gray-300 font-mono text-xs whitespace-pre-wrap">
                  {selectedContext.data.content || JSON.stringify(selectedContext.data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FolderOpen className="w-8 h-8 text-gray-600 mx-auto mb-1" />
              <h3 className="text-xs font-medium text-gray-400 mb-1">No Context Selected</h3>
              <p className="text-xs text-gray-500">Select a context from the list or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};