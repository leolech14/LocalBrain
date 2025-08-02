import React, { useState, useEffect } from 'react';
import { 
  Search, Folder, File, FileText, Image, Film, Music, Archive,
  Database, Globe, Brain, Tags, Calendar, User, Star, Download,
  Upload, Trash2, Edit, Eye, Share2, Lock, Unlock, ChevronRight,
  ChevronDown, BarChart, Clock, HardDrive
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ApiResponse } from '../types';

interface KnowledgeItem {
  id: string;
  name: string;
  item_type: 'folder' | 'document' | 'image' | 'video' | 'audio' | 'dataset' | 'model';
  size: number;
  modified: string;
  author: string;
  tags: string[];
  description?: string;
  vectorized: boolean;
  embedding_count?: number;
  private: boolean;
  starred: boolean;
  path: string;
  children?: KnowledgeItem[];
  content?: string;
}

interface StorageInfo {
  used_bytes: number;
  total_bytes: number;
  percentage: number;
}


const getFileIcon = (type: string) => {
  const icons = {
    folder: Folder,
    document: FileText,
    image: Image,
    video: Film,
    audio: Music,
    dataset: Database,
    model: Brain
  };
  const Icon = icons[type.toLowerCase() as keyof typeof icons] || File;
  return <Icon className="w-3 h-3" />;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const KnowledgeBaseBrowser: React.FC = () => {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showPrivate, setShowPrivate] = useState(true);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [itemContent, setItemContent] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(192); // w-48 = 192px
  
  useEffect(() => {
    loadItems();
    loadStorageInfo();
  }, []);
  
  const loadItems = async () => {
    try {
      const response = await invoke<ApiResponse<KnowledgeItem[]>>('get_knowledge_items');
      if (response.success && response.data) {
        setItems(response.data);
      }
    } catch (error) {
    }
  };
  
  const loadStorageInfo = async () => {
    try {
      const response = await invoke<ApiResponse<StorageInfo>>('get_knowledge_storage_info');
      if (response.success && response.data) {
        setStorageInfo(response.data);
      }
    } catch (error) {
    }
  };
  
  const loadItemContent = async (itemId: string) => {
    try {
      const response = await invoke<ApiResponse<string>>('read_knowledge_content', { itemId });
      if (response.success && response.data) {
        setItemContent(response.data);
      }
    } catch (error) {
      setItemContent(null);
    }
  };
  
  const createFolder = async () => {
    const name = prompt('Enter folder name:');
    if (!name) return;
    
    try {
      const response = await invoke<ApiResponse<KnowledgeItem>>('create_knowledge_folder', {
        name,
        parentPath: selectedItem?.item_type === 'folder' ? selectedItem.path : null
      });
      if (response.success) {
        await loadItems();
      }
    } catch (error) {
    }
  };
  
  const uploadFile = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      setIsUploading(true);
      try {
        const content = await file.arrayBuffer();
        const response = await invoke<ApiResponse<KnowledgeItem>>('upload_knowledge_file', {
          fileName: file.name,
          content: Array.from(new Uint8Array(content)),
          parentPath: selectedItem?.item_type === 'folder' ? selectedItem.path : null
        });
        if (response.success) {
          await loadItems();
          await loadStorageInfo();
        }
      } catch (error) {
      } finally {
        setIsUploading(false);
      }
    };
    input.click();
  };
  
  const deleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      const response = await invoke<ApiResponse<void>>('delete_knowledge_item', { itemId });
      if (response.success) {
        await loadItems();
        await loadStorageInfo();
        if (selectedItem?.id === itemId) {
          setSelectedItem(null);
          setItemContent(null);
        }
      }
    } catch (error) {
    }
  };
  
  const toggleStar = async (itemId: string) => {
    try {
      const response = await invoke<ApiResponse<boolean>>('toggle_knowledge_star', { itemId });
      if (response.success) {
        await loadItems();
      }
    } catch (error) {
    }
  };
  
  const togglePrivate = async (itemId: string) => {
    try {
      const response = await invoke<ApiResponse<boolean>>('toggle_knowledge_private', { itemId });
      if (response.success) {
        await loadItems();
      }
    } catch (error) {
    }
  };
  
  const vectorizeItem = async (itemId: string) => {
    try {
      const response = await invoke<ApiResponse<void>>('vectorize_knowledge_item', { itemId });
      if (response.success) {
        await loadItems();
      }
    } catch (error) {
    }
  };
  
  const updateTags = async (itemId: string, tags: string[]) => {
    try {
      const response = await invoke<ApiResponse<void>>('update_knowledge_tags', { itemId, tags });
      if (response.success) {
        await loadItems();
      }
    } catch (error) {
    }
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const getAllTags = (items: KnowledgeItem[]): string[] => {
    const tags = new Set<string>();
    const collectTags = (items: KnowledgeItem[]) => {
      items.forEach(item => {
        item.tags.forEach(tag => tags.add(tag));
        if (item.children) collectTags(item.children);
      });
    };
    collectTags(items);
    return Array.from(tags);
  };

  const filterItems = (items: KnowledgeItem[]): KnowledgeItem[] => {
    return items.filter(item => {
      if (!showPrivate && item.private) return false;
      if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        if (item.children) {
          const filteredChildren = filterItems(item.children);
          return filteredChildren.length > 0;
        }
        return false;
      }
      if (filterTags.length > 0 && !filterTags.some(tag => item.tags.includes(tag))) {
        if (item.children) {
          const filteredChildren = filterItems(item.children);
          return filteredChildren.length > 0;
        }
        return false;
      }
      return true;
    }).map(item => ({
      ...item,
      children: item.children ? filterItems(item.children) : undefined
    }));
  };

  const renderItems = (items: KnowledgeItem[], level = 0) => {
    const filtered = filterItems(items);
    
    return filtered.map(item => (
      <div key={item.id}>
        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 hover:bg-gray-900 cursor-pointer rounded transition-colors ${
            selectedItem?.id === item.id ? 'bg-gray-900' : ''
          }`}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
          onClick={() => {
            setSelectedItem(item);
            if (item.item_type === 'folder') {
              toggleFolder(item.id);
            } else if (item.item_type === 'document') {
              loadItemContent(item.id);
            }
          }}
        >
          {item.item_type === 'folder' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(item.id);
              }}
              className="p-0.5"
            >
              {expandedFolders.has(item.id) ? (
                <ChevronDown className="w-3 h-3 text-gray-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-gray-400" />
              )}
            </button>
          )}
          
          <div className={`${item.item_type !== 'folder' ? 'ml-5' : ''}`}>
            {getFileIcon(item.item_type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-xs text-white truncate">{item.name}</span>
              {item.private && <Lock className="w-3 h-3 text-gray-400" />}
              {item.starred && <Star className="w-3 h-3 text-yellow-500 fill-current" />}
              {item.vectorized && <Brain className="w-3 h-3 text-gray-400" />}
            </div>
          </div>
          
          <div className="text-xs text-gray-500">
            {formatFileSize(item.size)}
          </div>
        </div>
        
        {item.children && expandedFolders.has(item.id) && (
          <div>{renderItems(item.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  const allTags = getAllTags(items);

  return (
    <div className="flex h-full bg-black">
      {/* Knowledge Base Browser */}
      {/* Sidebar */}
      <div 
        className="bg-gray-950 border-r border-gray-800 flex flex-col"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="p-1 border-b border-gray-800">
          <h2 className="text-xs font-semibold text-white mb-1">Knowledge Base</h2>
          
          {/* Search */}
          <div className="relative mb-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
            <input
              type="text"
              placeholder="Search knowledge base..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2 py-1 text-xs bg-black text-white rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>

          {/* Filters */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Show private</span>
              <button
                onClick={() => setShowPrivate(!showPrivate)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  showPrivate ? 'bg-black' : 'bg-gray-600'
                }`}
              >
                <div className={`w-3 h-3 bg-white rounded-full transition-transform ${
                  showPrivate ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-1 mb-1">
                <Tags className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-400">Filter by tags</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (filterTags.includes(tag)) {
                        setFilterTags(filterTags.filter(t => t !== tag));
                      } else {
                        setFilterTags([...filterTags, tag]);
                      }
                    }}
                    className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                      filterTags.includes(tag)
                        ? 'bg-black text-white'
                        : 'bg-gray-900 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1 mt-1">
            <button 
              onClick={uploadFile}
              disabled={isUploading}
              className="flex-1 px-1.5 py-0.5 bg-black text-white rounded hover:bg-gray-900 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-3 h-3" />
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
            <button 
              onClick={createFolder}
              className="flex-1 px-1.5 py-0.5 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
            >
              <Folder className="w-3 h-3" />
              New
            </button>
          </div>
        </div>

        {/* File Tree */}
        <div className="flex-1 overflow-y-auto p-1">
          {renderItems(items)}
        </div>

        {/* Storage Info */}
        {storageInfo && (
          <div className="p-1 border-t border-gray-800">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Storage Used</span>
              <span>{formatFileSize(storageInfo.used_bytes)} / {formatFileSize(storageInfo.total_bytes)}</span>
            </div>
            <div className="w-full bg-gray-900 rounded-full h-2">
              <div className="bg-black h-2 rounded-full" style={{ width: `${storageInfo.percentage}%` }} />
            </div>
          </div>
        )}
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

      {/* Content Area */}
      <div className="flex-1 flex flex-col">
        {selectedItem ? (
          <>
            {/* Header */}
            <div className="p-1 border-b border-gray-800">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-1">
                  <div className="p-1 bg-gray-900 rounded">
                    {getFileIcon(selectedItem.item_type)}
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold text-white mb-1">
                      {selectedItem.name}
                    </h2>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {selectedItem.author}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(selectedItem.modified).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {formatFileSize(selectedItem.size)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => toggleStar(selectedItem.id)}
                    className={`p-1 rounded transition-colors ${
                      selectedItem.starred 
                        ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                        : 'bg-gray-900 text-white hover:bg-gray-700'
                    }`}
                  >
                    <Star className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={() => togglePrivate(selectedItem.id)}
                    className="p-1 bg-gray-900 text-white rounded hover:bg-gray-700"
                  >
                    {selectedItem.private ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  </button>
                  <button className="p-1 bg-gray-900 text-white rounded hover:bg-gray-700">
                    <Download className="w-3 h-3" />
                  </button>
                  <button className="p-1 bg-gray-900 text-white rounded hover:bg-gray-700">
                    <Share2 className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={() => deleteItem(selectedItem.id)}
                    className="p-1 bg-gray-900 text-white rounded hover:bg-gray-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div className="flex items-center gap-1 mt-1">
                <Tags className="w-3 h-3 text-gray-400" />
                {selectedItem.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-1.5 py-0.5 bg-gray-900 text-gray-300 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Vectorization Info */}
              {selectedItem.vectorized && selectedItem.embedding_count && (
                <div className="mt-1 p-1 bg-black rounded flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Brain className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-300">
                      Vectorized with {selectedItem.embedding_count} embeddings
                    </span>
                  </div>
                  <button className="text-xs text-gray-400 hover:text-blue-300">
                    View in Context
                  </button>
                </div>
              )}
              {!selectedItem.vectorized && (selectedItem.item_type === 'document' || selectedItem.item_type === 'dataset') && (
                <div className="mt-1 p-1 bg-black rounded">
                  <button 
                    onClick={() => vectorizeItem(selectedItem.id)}
                    className="text-xs text-gray-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Brain className="w-3 h-3" />
                    Vectorize this item
                  </button>
                </div>
              )}
            </div>

            {/* Content Preview */}
            <div className="flex-1 p-1 overflow-auto">
              {selectedItem.item_type === 'document' && itemContent && (
                <div className="prose prose-invert max-w-none">
                  <pre className="bg-black p-1 rounded text-gray-300">
                    {itemContent}
                  </pre>
                </div>
              )}
              {selectedItem.item_type === 'image' && (
                <div className="flex items-center justify-center h-full">
                  <div className="bg-black p-1 rounded">
                    <Image className="w-32 h-32 text-gray-600" />
                    <p className="text-center text-gray-400 mt-1">Image Preview</p>
                  </div>
                </div>
              )}
              {selectedItem.item_type === 'model' && (
                <div className="bg-black rounded p-1">
                  <h3 className="text-xs font-semibold text-white mb-1">Model Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 border-b border-gray-800">
                      <span className="text-gray-400">Type</span>
                      <span className="text-white">Neural Network</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-800">
                      <span className="text-gray-400">Framework</span>
                      <span className="text-white">
                        {selectedItem.name.endsWith('.onnx') ? 'ONNX' : 'PyTorch'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-800">
                      <span className="text-gray-400">Size</span>
                      <span className="text-white">{formatFileSize(selectedItem.size)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-400">Status</span>
                      <span className="text-green-400">Ready to load</span>
                    </div>
                  </div>
                  <button className="mt-1 px-1.5 py-0.5 bg-black text-white rounded hover:bg-gray-900 transition-colors flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    Load Model
                  </button>
                </div>
              )}
              {selectedItem.item_type === 'folder' && (
                <div className="text-center text-gray-400">
                  <Folder className="w-12 h-12 mx-auto mb-1 text-gray-600" />
                  <p>Folder contains {selectedItem.children?.length || 0} items</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Database className="w-12 h-12 text-gray-600 mx-auto mb-1" />
              <h3 className="text-xs font-medium text-gray-400 mb-1">No Item Selected</h3>
              <p className="text-xs text-gray-500">Select an item from the knowledge base to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};