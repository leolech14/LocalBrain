import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Plus, GitBranch, Cpu, Zap, Eye, Save } from 'lucide-react';
import { Editor } from '@monaco-editor/react';
import { invoke } from '@tauri-apps/api/core';
import { ApiResponse } from '../types';

interface AgentNode {
  id: string;
  name: string;
  agent_type: 'input' | 'processor' | 'output' | 'condition' | 'transform' | 'storage';
  x: number;
  y: number;
  config: Record<string, unknown>;
  status: 'idle' | 'running' | 'success' | 'error' | 'disabled';
  created_at: string;
  updated_at: string;
}

interface AgentConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
  condition?: string;
}

interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  nodes: AgentNode[];
  connections: AgentConnection[];
  created_at: string;
  updated_at: string;
}

export const AgentsCanvas: React.FC = () => {
  const [currentWorkflow, setCurrentWorkflow] = useState<AgentWorkflow | null>(null);
  const [workflows, setWorkflows] = useState<AgentWorkflow[]>([]);
  const [availableAgents, setAvailableAgents] = useState<Array<[string, string, string]>>([]);
  const [selectedNode, setSelectedNode] = useState<AgentNode | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedAgent, setDraggedAgent] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  // const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [leftPanelWidth, setLeftPanelWidth] = useState(192); // w-48 = 192px
  const [rightPanelWidth, setRightPanelWidth] = useState(320); // w-80 = 320px
  const canvasRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    loadWorkflows();
    loadAvailableAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWorkflows = async () => {
    try {
      const response = await invoke<ApiResponse<AgentWorkflow[]>>('list_agent_workflows');
      if (response.success && response.data) {
        setWorkflows(response.data);
        if (response.data.length > 0 && !currentWorkflow) {
          setCurrentWorkflow(response.data[0]);
        }
      }
    } catch (error) {
    }
  };

  const loadAvailableAgents = async () => {
    try {
      const response = await invoke<ApiResponse<Array<[string, string, string]>>>('get_available_agents');
      if (response.success && response.data) {
        setAvailableAgents(response.data);
      }
    } catch (error) {
    }
  };

  const createWorkflow = async () => {
    const name = prompt('Enter workflow name:');
    if (!name) return;
    
    const description = prompt('Enter workflow description:') || '';
    
    try {
      const response = await invoke<ApiResponse<string>>('create_agent_workflow', {
        name,
        description
      });
      
      if (response.success && response.data) {
        await loadWorkflows();
      }
    } catch (error) {
    }
  };

  const saveWorkflow = async () => {
    if (!currentWorkflow) return;
    
    try {
      const response = await invoke<ApiResponse<void>>('update_agent_workflow', {
        workflow: currentWorkflow
      });
      
      if (response.success) {
        // Workflow saved successfully
      }
    } catch (error) {
    }
  };

  const runWorkflow = async () => {
    if (!currentWorkflow) return;
    
    setIsRunning(true);
    
    try {
      const response = await invoke<ApiResponse<unknown>>('execute_agent_workflow', {
        workflowId: currentWorkflow.id,
        input: { test: true }
      });
      
      if (response.success) {
        // Workflow execution completed
        
        // Simulate status changes
        let delay = 0;
        currentWorkflow.nodes.forEach(node => {
          setTimeout(() => {
            setCurrentWorkflow(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                nodes: prev.nodes.map(n => 
                  n.id === node.id ? { ...n, status: 'running' as const } : n
                )
              };
            });
            
            setTimeout(() => {
              setCurrentWorkflow(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  nodes: prev.nodes.map(n => 
                    n.id === node.id ? { ...n, status: 'success' as const } : n
                  )
                };
              });
            }, 1000);
          }, delay);
          delay += 500;
        });
      }
    } catch (error) {
    } finally {
      setTimeout(() => {
        setIsRunning(false);
        if (currentWorkflow) {
          setCurrentWorkflow({
            ...currentWorkflow,
            nodes: currentWorkflow.nodes.map(n => ({ ...n, status: 'idle' as const }))
          });
        }
      }, (currentWorkflow?.nodes.length || 0) * 500 + 1000);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    const node = currentWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node) return;

    setIsDragging(true);
    setDraggedAgent(nodeId);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left - node.x,
        y: e.clientY - rect.top - node.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !draggedAgent || !currentWorkflow) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const newX = e.clientX - rect.left - dragOffset.x;
      const newY = e.clientY - rect.top - dragOffset.y;

      setCurrentWorkflow({
        ...currentWorkflow,
        nodes: currentWorkflow.nodes.map(node => 
          node.id === draggedAgent
            ? { ...node, x: newX, y: newY }
            : node
        )
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedAgent(null);
  };

  const addAgent = async (agentType: string, agentName: string) => {
    if (!currentWorkflow) return;

    const newNode: AgentNode = {
      id: `agent${Date.now()}`,
      name: agentName,
      agent_type: agentType as any,
      x: 400,
      y: 300,
      config: {},
      status: 'idle',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setCurrentWorkflow({
      ...currentWorkflow,
      nodes: [...currentWorkflow.nodes, newNode],
      updated_at: new Date().toISOString()
    });
  };

  const deleteNode = (nodeId: string) => {
    if (!currentWorkflow) return;
    
    setCurrentWorkflow({
      ...currentWorkflow,
      nodes: currentWorkflow.nodes.filter(n => n.id !== nodeId),
      connections: currentWorkflow.connections.filter(c => c.from !== nodeId && c.to !== nodeId),
      updated_at: new Date().toISOString()
    });
    
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'input': return <GitBranch className="w-3 h-3" />;
      case 'processor': return <Cpu className="w-3 h-3" />;
      case 'output': return <Zap className="w-3 h-3" />;
      case 'condition': return <Eye className="w-3 h-3" />;
      default: return <Cpu className="w-3 h-3" />;
    }
  };

  const getNodeColor = (status: string) => {
    switch (status) {
      case 'running': return 'border-gray-600 bg-black/20';
      case 'success': return 'border-green-500 bg-green-500/20';
      case 'error': return 'border-red-500 bg-red-500/20';
      default: return 'border-gray-600 bg-black';
    }
  };

  return (
    <div className="flex h-full bg-black">
      {/* Left Sidebar - Workflows and Available Agents */}
      <div 
        className="bg-black border-r border-gray-700 flex flex-col"
        style={{ width: `${leftPanelWidth}px` }}
      >
        <div className="p-2 border-b border-gray-700">
          <h3 className="text-xs font-semibold text-white mb-2">Workflows</h3>
          <button
            onClick={createWorkflow}
            className="w-full px-2 py-1 text-xs bg-black text-white rounded hover:bg-gray-900 transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {workflows.map(workflow => (
            <button
              key={workflow.id}
              onClick={() => setCurrentWorkflow(workflow)}
              className={`w-full text-left px-2 py-1 rounded mb-0.5 text-xs transition-colors ${
                currentWorkflow?.id === workflow.id
                  ? 'bg-black text-white'
                  : 'text-gray-300 hover:bg-gray-900'
              }`}
            >
              <div className="font-medium text-xs">{workflow.name}</div>
              <div className="text-xs opacity-70">{workflow.nodes.length} nodes</div>
            </button>
          ))}
        </div>
        
        <div className="border-t border-gray-700 p-2">
          <h4 className="text-xs font-semibold text-gray-300 mb-1">Available Agents</h4>
          <div className="space-y-1">
            {availableAgents.map(([id, name, type]) => (
              <button
                key={id}
                onClick={() => addAgent(id, name)}
                className="w-full text-left px-1.5 py-0.5 text-xs text-gray-300 hover:bg-gray-900 rounded transition-colors flex items-center gap-1"
              >
                {getNodeIcon(type)}
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Left Resize Handle */}
      <div
        className="w-1 bg-gray-900 hover:bg-gray-700 cursor-col-resize transition-colors"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.pageX;
          const startWidth = leftPanelWidth;
          
          const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(150, Math.min(400, startWidth + e.pageX - startX));
            setLeftPanelWidth(newWidth);
          };
          
          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
      />

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden bg-gray-850">
        {/* Toolbar */}
        <div className="absolute top-2 left-4 right-4 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={runWorkflow}
              disabled={!currentWorkflow || isRunning}
              className={`px-2 py-1 rounded-md flex items-center gap-2 font-medium transition-colors ${
                isRunning
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run
                </>
              )}
            </button>
            <button
              onClick={saveWorkflow}
              disabled={!currentWorkflow}
              className="px-2 py-1 bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
          <div className="bg-black px-2 py-1 rounded-md">
            <span className="text-sm text-gray-400">
              {currentWorkflow ? (
                <>
                  {currentWorkflow.name}: {currentWorkflow.nodes.length} nodes, {currentWorkflow.connections.length} connections
                </>
              ) : (
                'No workflow selected'
              )}
            </span>
          </div>
        </div>

        {/* SVG Canvas */}
        {currentWorkflow && (
          <svg
            ref={canvasRef}
            className="w-full h-full"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Grid Background */}
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#374151" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Connections */}
            {currentWorkflow.connections.map(conn => {
              const fromNode = currentWorkflow.nodes.find(n => n.id === conn.from);
              const toNode = currentWorkflow.nodes.find(n => n.id === conn.to);
              if (!fromNode || !toNode) return null;

              const path = `M ${fromNode.x + 100} ${fromNode.y + 30} L ${toNode.x} ${toNode.y + 30}`;
              
              return (
                <g key={conn.id}>
                  <path
                    d={path}
                    stroke="#4B5563"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                  />
                  {conn.label && (
                    <text
                      x={(fromNode.x + toNode.x + 100) / 2}
                      y={(fromNode.y + toNode.y + 60) / 2 - 5}
                      fill="#9CA3AF"
                      fontSize="12"
                      textAnchor="middle"
                      className="font-mono"
                    >
                      {conn.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Arrow marker */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="#4B5563"
                />
              </marker>
            </defs>

            {/* Agent Nodes */}
            {currentWorkflow.nodes.map(node => (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onClick={() => setSelectedNode(node)}
                className="cursor-pointer"
              >
                <rect
                  width="200"
                  height="60"
                  rx="8"
                  className={`${getNodeColor(node.status)} border-2 transition-all`}
                  fill="currentColor"
                  stroke="currentColor"
                />
                <g className="pointer-events-none">
                  <foreignObject x="10" y="10" width="40" height="40">
                    <div className="w-10 h-10 bg-gray-900 rounded-md flex items-center justify-center text-gray-300">
                      {getNodeIcon(node.agent_type)}
                    </div>
                  </foreignObject>
                  <text x="60" y="25" fill="white" fontSize="14" fontWeight="500">
                    {node.name}
                  </text>
                  <text x="60" y="45" fill="#9CA3AF" fontSize="12">
                    {node.agent_type}
                  </text>
                </g>
                <g
                  transform="translate(170, 20)"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNode(node.id);
                  }}
                  className="cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
                >
                  <circle r="10" fill="#EF4444" />
                  <text x="0" y="5" fill="white" fontSize="12" textAnchor="middle">
                    ×
                  </text>
                </g>
              </g>
            ))}
          </svg>
        )}
      </div>

      {/* Properties Panel */}
      {selectedNode && (
        <>
          {/* Resize Handle */}
          <div
            className="w-1 bg-gray-900 hover:bg-gray-700 cursor-col-resize transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.pageX;
              const startWidth = rightPanelWidth;
              
              const handleMouseMove = (e: MouseEvent) => {
                const newWidth = Math.max(200, Math.min(500, startWidth - (e.pageX - startX)));
                setRightPanelWidth(newWidth);
              };
              
              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />
          <div 
            className="bg-black border-l border-gray-700 p-2 overflow-y-auto"
            style={{ width: `${rightPanelWidth}px` }}
          >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold text-white">Agent Properties</h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="space-y-1">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={selectedNode.name}
                onChange={(e) => {
                  if (!currentWorkflow) return;
                  setCurrentWorkflow({
                    ...currentWorkflow,
                    nodes: currentWorkflow.nodes.map(n => 
                      n.id === selectedNode.id
                        ? { ...n, name: e.target.value }
                        : n
                    )
                  });
                  setSelectedNode({ ...selectedNode, name: e.target.value });
                }}
                className="w-full px-2 py-1 text-xs bg-gray-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-gray-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Type
              </label>
              <input
                type="text"
                value={selectedNode.agent_type}
                disabled
                className="w-full px-2 py-1 text-xs bg-gray-900 text-gray-400 rounded"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Configuration
              </label>
              <div className="h-64 border border-gray-700 rounded-md overflow-hidden">
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  theme="vs-dark"
                  value={JSON.stringify(selectedNode.config, null, 2)}
                  onChange={(value) => {
                    if (!currentWorkflow) return;
                    try {
                      const config = JSON.parse(value || '{}');
                      setCurrentWorkflow({
                        ...currentWorkflow,
                        nodes: currentWorkflow.nodes.map(n => 
                          n.id === selectedNode.id
                            ? { ...n, config }
                            : n
                        )
                      });
                      setSelectedNode({ ...selectedNode, config });
                    } catch (e) {
                      // Invalid JSON, ignore
                    }
                  }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    lineNumbers: 'off',
                    scrollBeyondLastLine: false
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Status
              </label>
              <div className={`px-2 py-1 text-xs rounded text-center font-medium ${
                selectedNode.status === 'running' ? 'bg-black text-white' :
                selectedNode.status === 'success' ? 'bg-green-600 text-white' :
                selectedNode.status === 'error' ? 'bg-red-600 text-white' :
                'bg-gray-900 text-gray-300'
              }`}>
                {selectedNode.status.toUpperCase()}
              </div>
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  );
};