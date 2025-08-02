import React, { useState, useEffect } from 'react';
import { 
  Terminal, Code, GitBranch, Database, Zap, Shield, Search, 
  Filter, Star, ExternalLink, Copy, Play, Settings, Package,
  Cpu, Globe, Lock, FileCode, BarChart, Layers, CheckCircle
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ApiResponse } from '../types';

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  version: string;
  author: string;
  stars: number;
  installs: number;
  tags: string[];
  documentation: string;
  examples: string[];
  requirements: string[];
  installed: boolean;
  plugin_id?: string;
  executable_path?: string;
  config_schema?: any;
}

interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  exit_code?: number;
  execution_time: number;
}

const getIconComponent = (iconName: string) => {
  const icons: { [key: string]: any } = {
    GitBranch, Code, Database, Zap, Shield, BarChart, Cpu, Globe, Lock, FileCode
  };
  const Icon = icons[iconName] || Package;
  return <Icon className="w-4 h-4" />;
};

export const ToolkitLibrary: React.FC = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<{ name: string; icon: any; count: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [sortBy, setSortBy] = useState<'stars' | 'installs' | 'name'>('stars');
  const [isInstalling, setIsInstalling] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ToolResult | null>(null);
  
  useEffect(() => {
    loadTools();
    loadCategories();
  }, []);
  
  const loadTools = async (category?: string) => {
    try {
      const response = await invoke<ApiResponse<Tool[]>>('list_tools', {
        category: category === 'All' ? null : category
      });
      if (response.success && response.data) {
        setTools(response.data);
      }
    } catch (error) {
    }
  };
  
  const loadCategories = async () => {
    try {
      const response = await invoke<ApiResponse<[string, number][]>>('get_tool_categories');
      if (response.success && response.data) {
        const categoryIcons: { [key: string]: any } = {
          'Git': GitBranch,
          'Code Quality': Code,
          'Database': Database,
          'Testing': Zap,
          'Security': Shield,
          'Performance': BarChart,
        };
        
        const categoriesData = response.data.map(([name, count]) => ({
          name,
          icon: categoryIcons[name] || Package,
          count
        }));
        
        // Add "All" category
        const totalCount = response.data.reduce((sum, [, count]) => sum + count, 0);
        setCategories([
          { name: 'All', icon: Layers, count: totalCount },
          ...categoriesData
        ]);
      }
    } catch (error) {
    }
  };

  const filteredTools = tools
    .filter(tool => selectedCategory === 'All' || tool.category === selectedCategory)
    .filter(tool => 
      tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === 'stars') return b.stars - a.stars;
      if (sortBy === 'installs') return b.installs - a.installs;
      return a.name.localeCompare(b.name);
    });

  const installTool = async (toolId: string) => {
    setIsInstalling(true);
    try {
      const response = await invoke<ApiResponse<void>>('install_tool', { toolId });
      if (response.success) {
        await loadTools(selectedCategory === 'All' ? undefined : selectedCategory);
        if (selectedTool?.id === toolId) {
          const toolResponse = await invoke<ApiResponse<Tool>>('get_tool', { toolId });
          if (toolResponse.success && toolResponse.data) {
            setSelectedTool(toolResponse.data);
          }
        }
      } else {
      }
    } catch (error) {
    } finally {
      setIsInstalling(false);
    }
  };

  const uninstallTool = async (toolId: string) => {
    setIsInstalling(true);
    try {
      const response = await invoke<ApiResponse<void>>('uninstall_tool', { toolId });
      if (response.success) {
        await loadTools(selectedCategory === 'All' ? undefined : selectedCategory);
        if (selectedTool?.id === toolId) {
          const toolResponse = await invoke<ApiResponse<Tool>>('get_tool', { toolId });
          if (toolResponse.success && toolResponse.data) {
            setSelectedTool(toolResponse.data);
          }
        }
      } else {
      }
    } catch (error) {
    } finally {
      setIsInstalling(false);
    }
  };
  
  const executeTool = async (toolId: string, args: string[] = []) => {
    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const response = await invoke<ApiResponse<ToolResult>>('execute_tool', {
        toolId,
        command: 'run',
        args,
        options: {}
      });
      if (response.success && response.data) {
        setExecutionResult(response.data);
      } else {
      }
    } catch (error) {
    } finally {
      setIsExecuting(false);
    }
  };
  
  const searchTools = async (query: string) => {
    if (query.trim()) {
      try {
        const response = await invoke<ApiResponse<Tool[]>>('search_tools', { query });
        if (response.success && response.data) {
          setTools(response.data);
        }
      } catch (error) {
      }
    } else {
      await loadTools(selectedCategory === 'All' ? undefined : selectedCategory);
    }
  };
  
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm) {
        searchTools(searchTerm);
      } else {
        loadTools(selectedCategory === 'All' ? undefined : selectedCategory);
      }
    }, 300);
    
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);
  
  useEffect(() => {
    loadTools(selectedCategory === 'All' ? undefined : selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="flex h-full bg-black">
      {/* Sidebar */}
      <div className="w-48 bg-black border-r border-gray-700 flex flex-col">
        <div className="p-2 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-white mb-1">Toolkit Library</h2>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-gray-900 text-white rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex-1 overflow-y-auto p-2">
          {categories.map(category => (
            <button
              key={category.name}
              onClick={() => setSelectedCategory(category.name)}
              className={`w-full flex items-center gap-1 px-2 py-1 rounded-md mb-1 transition-colors ${
                selectedCategory === category.name
                  ? 'bg-black text-white'
                  : 'text-gray-300 hover:bg-gray-900'
              }`}
            >
              <category.icon className="w-3 h-3" />
              <span className="flex-1 text-left">{category.name}</span>
              <span className="text-sm opacity-70">{category.count}</span>
            </button>
          ))}
        </div>

        {/* Sort Options */}
        <div className="p-2 border-t border-gray-700">
          <label className="block text-sm text-gray-400 mb-2">Sort by</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-2 py-1 bg-gray-900 text-white rounded-md focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="stars">Most Stars</option>
            <option value="installs">Most Installs</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {filteredTools.map(tool => (
            <div
              key={tool.id}
              onClick={() => setSelectedTool(tool)}
              className="bg-black rounded-md p-2 border border-gray-700 hover:border-gray-600 cursor-pointer transition-all hover:shadow-lg"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-gray-900 rounded-md">
                  {getIconComponent(tool.icon)}
                </div>
                {tool.installed && (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                )}
              </div>
              
              <h3 className="text-sm font-semibold text-white mb-1">{tool.name}</h3>
              <p className="text-sm text-gray-400 mb-3 line-clamp-2">{tool.description}</p>
              
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  {tool.stars}
                </span>
                <span className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  {tool.installs.toLocaleString()}
                </span>
                <span className="text-xs">v{tool.version}</span>
              </div>
              
              <div className="flex flex-wrap gap-1 mt-3">
                {tool.tags.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-1 bg-gray-900 text-gray-300 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tool Details Panel */}
      {selectedTool && (
        <div className="w-96 bg-black border-l border-gray-700 p-3 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-white">{selectedTool.name}</h3>
            <button
              onClick={() => setSelectedTool(null)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="mb-1">
            <div className="p-3 bg-gray-900 rounded-md inline-block mb-1">
              {getIconComponent(selectedTool.icon)}
            </div>
            
            <p className="text-gray-300 mb-1">{selectedTool.description}</p>
            
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <span>By {selectedTool.author}</span>
              <span>v{selectedTool.version}</span>
            </div>
            
            <div className="flex items-center gap-1">
              {selectedTool.installed ? (
                <>
                  <button
                    onClick={() => executeTool(selectedTool.id)}
                    disabled={isExecuting}
                    className="px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4" />
                    {isExecuting ? 'Running...' : 'Run'}
                  </button>
                  <button
                    onClick={() => uninstallTool(selectedTool.id)}
                    className="px-2 py-1 bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Uninstall
                  </button>
                </>
              ) : (
                <button
                  onClick={() => installTool(selectedTool.id)}
                  className="px-2 py-1 bg-black text-white rounded-md hover:bg-gray-900 transition-colors flex items-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  Install
                </button>
              )}
              <button className="p-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors">
                <Settings className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {/* Requirements */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Requirements</h4>
              <ul className="space-y-1">
                {selectedTool.requirements.map((req, idx) => (
                  <li key={idx} className="text-sm text-gray-400 flex items-center gap-2">
                    <span className="w-1 h-1 bg-gray-600 rounded-full" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            {/* Examples */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Examples</h4>
              <div className="space-y-2">
                {selectedTool.examples.map((example, idx) => (
                  <div key={idx} className="bg-black rounded-md p-3 font-mono text-sm text-gray-300 flex items-center justify-between group">
                    <span>{example}</span>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Copy className="w-4 h-4 text-gray-500 hover:text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {selectedTool.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-sm px-3 py-1 bg-gray-900 text-gray-300 rounded-md"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Documentation */}
            <div>
              <a
                href={selectedTool.documentation}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-400 hover:text-blue-300 text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                View Documentation
              </a>
            </div>
            
            {/* Execution Result */}
            {executionResult && (
              <div className={`p-2 rounded-md ${
                executionResult.success ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'
              }`}>
                <h4 className="text-sm font-semibold text-gray-300 mb-2">
                  Execution Result
                </h4>
                {executionResult.output && (
                  <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap mb-2">
                    {executionResult.output}
                  </pre>
                )}
                {executionResult.error && (
                  <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap mb-2">
                    {executionResult.error}
                  </pre>
                )}
                <div className="text-xs text-gray-500">
                  Exit code: {executionResult.exit_code} | Time: {executionResult.execution_time.toFixed(2)}s
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};