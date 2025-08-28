import React, { useCallback, useMemo, ChangeEvent, useState, useRef } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Connection,
  Edge,
  Panel,
  useReactFlow,
  NodeChange,
  EdgeChange,
} from 'reactflow';

import TextNode from './components/nodes/TextNode';
import LlmNode from './components/nodes/LlmNode';
import HttpRequestNode from './components/nodes/HttpRequestNode';
import Sidebar from './components/Sidebar';
import CanvasInfoPanel from './components/CanvasInfoPanel';
import GlobalVariablesPanel from './components/GlobalVariablesPanel';
import ContextMenu from './components/ContextMenu';
import { CustomNode } from './types';
import { AppContext } from './components/AppContext';

const initialNodes: CustomNode[] = [
  {
    id: '1',
    type: 'textNode',
    position: { x: 50, y: 50 },
    data: { label: 'Concept', text: 'Explain what a "node-based editor" is.' },
    style: { width: 256, height: 160 },
  },
  {
    id: '3',
    type: 'textNode',
    position: { x: 50, y: 250 },
    data: { label: 'Audience', text: 'Keep it simple, for a beginner.' },
    style: { width: 256, height: 160 },
  },
  {
    id: '2',
    type: 'llmNode',
    position: { x: 500, y: 150 },
    data: { 
      label: 'Gemini LLM', 
      prompt: 'Combine these ideas in a single paragraph for user $global.user.name:\n\nIdea 1: $Concept\nConstraint: $Audience', 
      isLoading: false,
      temperature: 0.7,
      thinkingEnabled: true,
    },
    style: { width: 320, height: 380 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', style: { stroke: '#a855f7' } },
  // FIX: Corrected typo in edge ID to be a valid string.
  { id: 'e3-2', source: '3', target: '2', style: { stroke: '#a855f7' } },
];

const createId = () => `node_${Date.now()}_${Math.random().toString(36).substring(7)}`;

interface ContextMenuState {
  top: number;
  left: number;
  position: { x: number; y: number };
}

const AppContent: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [canvasName, setCanvasName] = useState('Gemini Flow Canvas');
  const [canvasDescription, setCanvasDescription] = useState('An interactive canvas to create and connect nodes.');
  const [globalVariables, setGlobalVariables] = useState(
    JSON.stringify(
      {
        user: { name: 'Alex' },
        apiKey: 'your-secret-key-here'
      },
      null,
      2
    )
  );
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const parsedGlobals = useMemo(() => {
    try {
      return JSON.parse(globalVariables);
    } catch (e) {
      console.warn("Invalid JSON in global variables.", e);
      return {}; // Return empty object on parse error
    }
  }, [globalVariables]);

  const closeMenu = useCallback(() => setMenu(null), [setMenu]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
      onNodesChange(changes);
      closeMenu();
  }, [onNodesChange, closeMenu]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
      onEdgesChange(changes);
      closeMenu();
  }, [onEdgesChange, closeMenu]);

  const onConnect = useCallback(
    (params: Connection | Edge) => {
        setEdges((eds) => addEdge(params, eds));
        closeMenu();
    },
    [setEdges, closeMenu]
  );

  const nodeTypes = useMemo(() => ({
    textNode: TextNode,
    llmNode: LlmNode,
    httpRequestNode: HttpRequestNode,
  }), []);

  const addNode = useCallback((type: 'textNode' | 'llmNode' | 'httpRequestNode', position: { x: number, y: number }) => {
    const newNodeId = createId();
    let newNode: CustomNode;
    
    if (type === 'textNode') {
      newNode = {
        id: newNodeId,
        type: 'textNode',
        position,
        data: { label: 'New Text Node', text: 'Some new text' },
        style: { width: 256, height: 160 },
      };
    } else if (type === 'llmNode') {
      newNode = {
        id: newNodeId,
        type: 'llmNode',
        position,
        data: { 
            label: 'New LLM Node', 
            prompt: 'Write a haiku about React.', 
            isLoading: false,
            temperature: 0.7,
            thinkingEnabled: true,
        },
        style: { width: 320, height: 380 },
      };
    } else { // httpRequestNode
        newNode = {
            id: newNodeId,
            type: 'httpRequestNode',
            position,
            data: { 
                label: 'HTTP Request',
                method: 'GET',
                url: 'https://jsonplaceholder.typicode.com/todos/1',
                headers: 'Content-Type: application/json',
                body: '',
                isLoading: false 
            },
            style: { width: 384, height: 400 },
        }
    }
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  const onExport = useCallback(() => {
    const maskSensitiveValues = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(item => maskSensitiveValues(item));
      }

      const newObj: { [key: string]: any } = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const lowerCaseKey = key.toLowerCase();
          if (lowerCaseKey.includes('apikey') || lowerCaseKey.includes('secret') || lowerCaseKey.includes('token')) {
            newObj[key] = '******** MASKED FOR EXPORT ********';
          } else {
            newObj[key] = maskSensitiveValues(obj[key]);
          }
        }
      }
      return newObj;
    };

    let sanitizedGlobalVariables = globalVariables;
    try {
      const parsedGlobals = JSON.parse(globalVariables);
      const maskedGlobals = maskSensitiveValues(parsedGlobals);
      sanitizedGlobalVariables = JSON.stringify(maskedGlobals, null, 2);
    } catch (e) {
      console.warn("Could not parse and mask global variables for export. Exporting them as is.", e);
    }

    const flow = {
      name: canvasName,
      description: canvasDescription,
      globalVariables: sanitizedGlobalVariables,
      nodes,
      edges,
    };
    const jsonString = JSON.stringify(flow, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flow.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [nodes, edges, canvasName, canvasDescription, globalVariables]);
  
  const onImport = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== 'string') {
        alert('Failed to read file.');
        return;
      }
      try {
        const flow = JSON.parse(text);
        if (flow && Array.isArray(flow.nodes) && Array.isArray(flow.edges)) {
          setNodes(flow.nodes);
          setEdges(flow.edges);
          if (typeof flow.name === 'string') setCanvasName(flow.name);
          if (typeof flow.description === 'string') setCanvasDescription(flow.description);
          if (typeof flow.globalVariables === 'string') setGlobalVariables(flow.globalVariables);
        } else {
          alert('Invalid JSON format for flow.');
        }
      } catch (error) {
        console.error("Error parsing JSON file:", error);
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }, [setNodes, setEdges, setCanvasName, setCanvasDescription, setGlobalVariables]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      
      if (!mainRef.current) {
        return;
      }
      const mainBounds = mainRef.current.getBoundingClientRect();
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      
      setMenu({
        top: event.clientY - mainBounds.top,
        left: event.clientX - mainBounds.left,
        position,
      });
    },
    [screenToFlowPosition]
  );

  return (
    <AppContext.Provider value={{ globals: parsedGlobals }}>
      <div className="w-screen h-screen flex text-white font-sans antialiased overflow-hidden">
          <Sidebar isVisible={isSidebarVisible} />
          <div className="relative flex-grow h-full">
            <button
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              className={`absolute top-1/2 -translate-y-1/2 z-10 bg-gray-700 hover:bg-gray-600 text-white rounded-full w-6 h-6 flex items-center justify-center transition-all duration-300 ease-in-out ${
                isSidebarVisible ? 'left-[-12px]' : 'left-4'
              }`}
              title={isSidebarVisible ? 'Collapse Sidebar' : 'Expand Sidebar'}
              aria-label={isSidebarVisible ? 'Collapse Sidebar' : 'Expand Sidebar'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 transition-transform duration-300 ${isSidebarVisible ? '' : 'rotate-180'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <main ref={mainRef} className="h-full">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={onConnect}
                onPaneClick={closeMenu}
                onPaneContextMenu={onPaneContextMenu}
                nodeTypes={nodeTypes}
                fitView
                className="bg-gray-800"
              >
                <Background color="#4a5568" gap={16} />
                <Controls />
                <MiniMap 
                  nodeColor={(node: CustomNode) => {
                    switch (node.type) {
                      case 'textNode': return '#0891b2'; // cyan
                      case 'llmNode': return '#8b5cf6'; // purple
                      case 'httpRequestNode': return '#10b981'; // green
                      default: return '#6b7280'; // gray
                    }
                  }}
                  nodeStrokeWidth={3}
                  pannable
                />
                 <Panel position="top-left">
                  <CanvasInfoPanel
                    canvasName={canvasName}
                    canvasDescription={canvasDescription}
                    setCanvasName={setCanvasName}
                    setCanvasDescription={setCanvasDescription}
                  />
                </Panel>
                <Panel position="top-right">
                  <GlobalVariablesPanel
                    globalVariables={globalVariables}
                    setGlobalVariables={setGlobalVariables}
                  />
                </Panel>
              </ReactFlow>
               <input
                type="file"
                ref={fileInputRef}
                onChange={onImport}
                accept="application/json"
                className="hidden"
                data-testid="import-input"
              />
              {menu && (
                <ContextMenu
                  top={menu.top}
                  left={menu.left}
                  onClick={closeMenu}
                  onAddNode={(type) => addNode(type, menu.position)}
                  onExport={onExport}
                  onImport={handleImportClick}
                />
              )}
            </main>
          </div>
      </div>
    </AppContext.Provider>
  );
};

const App: React.FC = () => (
    <ReactFlowProvider>
        <AppContent />
    </ReactFlowProvider>
);

export default App;