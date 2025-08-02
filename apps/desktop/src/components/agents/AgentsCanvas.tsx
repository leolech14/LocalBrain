import React, { useCallback, useState } from 'react'
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  NodeTypes,
  Handle,
  Position
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Network, Play, Pause, RotateCcw, Plus, Settings } from 'lucide-react'

const AgentNode = ({ data }: { data: any }) => {
  const statusColors = {
    idle: 'border-gray-600',
    running: 'border-gray-600',
    success: 'border-green-500',
    error: 'border-red-500'
  }
  
  return (
    <div className={`px-2 py-1 bg-gray-900 rounded-md border-2 ${statusColors[data.status as keyof typeof statusColors || 'idle']} min-w-[200px]`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-white">{data.label}</span>
        <div className={`w-2 h-2 rounded-full ${
          data.status === 'running' ? 'bg-black animate-pulse' :
          data.status === 'success' ? 'bg-green-500' :
          data.status === 'error' ? 'bg-red-500' :
          'bg-gray-500'
        }`} />
      </div>
      <p className="text-xs text-gray-400">{data.description}</p>
      {data.metrics && (
        <div className="mt-2 text-xs text-gray-500">
          <div>Executions: {data.metrics.executions}</div>
          <div>Avg time: {data.metrics.avgTime}ms</div>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  )
}

const nodeTypes: NodeTypes = {
  agent: AgentNode
}

export function AgentsCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([
    {
      id: '1',
      type: 'agent',
      position: { x: 250, y: 50 },
      data: { 
        label: 'Task Router',
        description: 'Routes tasks to appropriate agents',
        status: 'running',
        metrics: { executions: 142, avgTime: 23 }
      }
    },
    {
      id: '2',
      type: 'agent',
      position: { x: 100, y: 200 },
      data: { 
        label: 'Code Expert',
        description: 'Handles code analysis and generation',
        status: 'idle',
        metrics: { executions: 89, avgTime: 156 }
      }
    },
    {
      id: '3',
      type: 'agent',
      position: { x: 400, y: 200 },
      data: { 
        label: 'Terminal Agent',
        description: 'Executes terminal commands',
        status: 'idle',
        metrics: { executions: 67, avgTime: 89 }
      }
    },
    {
      id: '4',
      type: 'agent',
      position: { x: 250, y: 350 },
      data: { 
        label: 'Quality Gate',
        description: 'Validates outputs and ensures quality',
        status: 'success',
        metrics: { executions: 298, avgTime: 45 }
      }
    }
  ])
  
  const [edges, setEdges, onEdgesChange] = useEdgesState([
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e1-3', source: '1', target: '3', animated: true },
    { id: 'e2-4', source: '2', target: '4' },
    { id: 'e3-4', source: '3', target: '4' }
  ])
  
  const [isRunning, setIsRunning] = useState(true)
  
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )
  
  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="px-2 py-1 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center">
            <Network className="w-3 h-3 mr-2" />
            Agents Canvas
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`px-3 py-1 rounded-md flex items-center space-x-2 transition-colors ${
                isRunning 
                  ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Start</span>
                </>
              )}
            </button>
            <button className="p-2 hover:bg-gray-900 rounded transition-colors">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button className="p-2 hover:bg-gray-900 rounded transition-colors">
              <Plus className="w-4 h-4" />
            </button>
            <button className="p-2 hover:bg-gray-900 rounded transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Stats Bar */}
      <div className="px-2 py-2 bg-gray-850 border-b border-gray-800 flex items-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <span className="text-gray-500">Active Agents:</span>
          <span className="font-semibold">4</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-gray-500">Total Executions:</span>
          <span className="font-semibold">596</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-gray-500">Avg Response:</span>
          <span className="font-semibold">78ms</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-gray-500">Success Rate:</span>
          <span className="font-semibold text-green-500">98.3%</span>
        </div>
      </div>
      
      {/* Flow Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#374151" gap={16} />
          <Controls />
          <MiniMap 
            nodeColor="#1f2937"
            maskColor="rgba(0, 0, 0, 0.5)"
            pannable
            zoomable
          />
        </ReactFlow>
      </div>
    </div>
  )
}