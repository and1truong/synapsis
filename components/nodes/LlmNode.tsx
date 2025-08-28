





import React, { useState, useCallback, useMemo, useContext } from 'react';
import { Handle, Position, NodeProps, useReactFlow, Node, useEdges, useNodes, NodeResizer } from 'reactflow';
import { LlmNodeData, TextNodeData, CustomNode } from '../../types';
import { generateTextStream } from '../../services/geminiService';
import { findAncestors, sanitizeLabel, substituteVariables, getAvailableGlobalVariables } from './node-utils';
import { AppContext } from '../AppContext';

const HighlightedPrompt: React.FC<{ prompt: string; variables: string[] }> = ({ prompt, variables }) => {
  if (!variables.length || !prompt) return <>{prompt || 'Double-click to edit prompt...'}</>;

  // Escape variables for regex and create a pattern to match any of them
  const escapedVariables = variables.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(\\$(?:${escapedVariables.join('|')}))`, 'g');
  
  const parts = prompt.split(regex).filter(part => part);

  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('$') && variables.includes(part.slice(1)) ? (
          <span key={i} className="bg-purple-900 ring-1 ring-purple-600 rounded px-1 py-0.5 font-mono">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};


const LlmNode: React.FC<NodeProps<LlmNodeData>> = ({ id, data, selected }) => {
  const { setNodes, addNodes, addEdges, getNode } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes() as CustomNode[];
  const { globals } = useContext(AppContext);

  const [isEditing, setIsEditing] = useState(false);
  const [prompt, setPrompt] = useState(data.prompt);

  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [label, setLabel] = useState(data.label);

  const [temperature, setTemperature] = useState(data.temperature ?? 0.7);
  const [thinkingEnabled, setThinkingEnabled] = useState(data.thinkingEnabled ?? true);
  
  const ancestorNodes = useMemo(() => findAncestors(id, nodes, edges), [id, nodes, edges]);
  
  const availableLocalVariables = useMemo(() => {
    return ancestorNodes
      .map(node => {
        if (node.data.label) {
          const sanitized = sanitizeLabel(node.data.label);
          return sanitized.length > 0 ? sanitized : null;
        }
        return null;
      })
      .filter((v): v is string => v !== null);
  }, [ancestorNodes]);
  
  const availableGlobalVariables = useMemo(() => getAvailableGlobalVariables(globals), [globals]);
  
  const allAvailableVariables = useMemo(() => {
    // Combine and remove duplicates
    return [...new Set([...availableLocalVariables, ...availableGlobalVariables])];
  }, [availableLocalVariables, availableGlobalVariables]);


  const updateNodeData = useCallback(<K extends keyof LlmNodeData>(key: K, value: LlmNodeData[K]) => {
      setNodes((nds) =>
        nds.map((node: Node) => {
          if (node.id === id) {
            return { ...node, data: { ...node.data, [key]: value } };
          }
          return node;
        })
      );
    },
    [id, setNodes]
  );
  
  const onPromptChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(evt.target.value);
  };

  const handleBlur = () => {
    updateNodeData('prompt', prompt);
    setIsEditing(false);
  };

  const handleHeaderBlur = () => {
    updateNodeData('label', label);
    setIsEditingHeader(false);
  };

  const handleHeaderKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (evt.key === 'Enter') {
      handleHeaderBlur();
    }
  };

  const handleTemperatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTemp = parseFloat(e.target.value);
    setTemperature(newTemp);
    updateNodeData('temperature', newTemp);
  };
  const handleThinkingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isEnabled = e.target.checked;
    setThinkingEnabled(isEnabled);
    updateNodeData('thinkingEnabled', isEnabled);
  };


  const runLlm = async () => {
    const parentNode = getNode(id);
    if (!parentNode) return;

    updateNodeData('isLoading', true);

    const replacements = ancestorNodes.reduce((acc, node) => {
      if (node.type === 'textNode' && typeof (node.data as TextNodeData).text === 'string' && node.data.label) {
        const varName = sanitizeLabel(node.data.label);
        if (varName) {
          acc[varName] = (node.data as TextNodeData).text;
        }
      }
      return acc;
    }, {} as Record<string, string>);
      
    const finalPrompt = substituteVariables(prompt, replacements, globals);

    const newNodeId = `textnode_${id}_${Date.now()}`;
    const newTextNode: Node<TextNodeData> = {
      id: newNodeId,
      type: 'textNode',
      position: { x: parentNode.position.x + (parentNode.width ?? 320) + 100, y: parentNode.position.y },
      data: { label: 'LLM Output', text: '⏳ Generating...' },
      style: { width: 320, height: 200 },
    };
    addNodes(newTextNode);

    const newEdge = {
      id: `edge-${id}-${newNodeId}`,
      source: id,
      target: newNodeId,
      animated: true,
      style: { stroke: '#a855f7' },
    };
    addEdges(newEdge);

    try {
        if (!finalPrompt.trim()) {
            throw new Error("Prompt is empty after variable substitution.");
        }

        const config = { temperature, thinkingEnabled };
        let fullText = '';
        let isFirstChunk = true;
        for await (const chunk of generateTextStream(finalPrompt, config)) {
            if (isFirstChunk) {
                fullText = chunk;
                isFirstChunk = false;
            } else {
                fullText += chunk;
            }

            setNodes((nds) =>
            nds.map((node) => {
                if (node.id === newNodeId) {
                return { ...node, data: { ...node.data, text: fullText } };
                }
                return node;
            })
            );
        }
    } catch (e) {
      console.error("Streaming failed", e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === newNodeId) {
            return { ...node, data: { ...node.data, text: `Error: ${errorMessage}` } };
          }
          return node;
        })
      );
    } finally {
      updateNodeData('isLoading', false);
      addEdges({ ...newEdge, animated: false });
    }
  };

  return (
    <div className="bg-gray-700 border-2 border-purple-500 rounded-lg shadow-xl text-white flex flex-col h-full overflow-hidden">
      <style>{`
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 40px;
          height: 24px;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #4b5563;
          transition: .4s;
          border-radius: 24px;
        }
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }
        input:checked + .toggle-slider {
          background-color: #8b5cf6;
        }
        input:checked + .toggle-slider:before {
          transform: translateX(16px);
        }
        .temp-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 8px;
          background: #4b5563;
          outline: none;
          opacity: 0.9;
          transition: opacity .2s;
          border-radius: 8px;
        }
        .temp-slider:hover {
          opacity: 1;
        }
        .temp-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          background: #a78bfa;
          cursor: pointer;
          border-radius: 50%;
        }
        .temp-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          background: #a78bfa;
          cursor: pointer;
          border-radius: 50%;
        }
        details[open] > summary .details-arrow {
          transform: rotate(180deg);
        }
      `}</style>
      <NodeResizer 
        isVisible={selected}
        minWidth={320}
        minHeight={350}
        lineClassName="border-purple-500"
        handleClassName="bg-purple-500 w-2 h-2 rounded-full"
      />
      <div className="bg-gray-800 px-4 py-2 rounded-t-lg font-bold flex justify-between items-center text-gray-300 shrink-0">
        <div 
            className="flex-grow cursor-pointer"
            onDoubleClick={() => setIsEditingHeader(true)}
        >
            {isEditingHeader ? (
                <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    onBlur={handleHeaderBlur}
                    onKeyDown={handleHeaderKeyDown}
                    autoFocus
                    className="bg-gray-700 text-white p-0 m-0 border-none focus:outline-none focus:ring-1 focus:ring-purple-500 rounded w-full"
                />
            ) : (
                <span>{data.label}</span>
            )}
        </div>
        <button
          onClick={runLlm}
          disabled={data.isLoading}
          className="ml-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white text-xs font-bold py-1 px-3 rounded-md transition-colors shrink-0"
        >
          {data.isLoading ? 'Running...' : 'Run'}
        </button>
      </div>
      
      <div className="p-4 flex-grow flex flex-col">
        <div className="flex flex-col flex-grow">
          <label className="text-xs font-semibold text-gray-400">PROMPT</label>
           <div onDoubleClick={() => setIsEditing(true)} className="flex-grow">
            {isEditing ? (
              <textarea
                value={prompt}
                onChange={onPromptChange}
                onBlur={handleBlur}
                autoFocus
                className="mt-1 w-full h-full p-2 bg-gray-800 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none"
                placeholder="Use $NodeLabel or $global.path to add variables."
              />
            ) : (
               <div className="mt-1 text-sm whitespace-pre-wrap h-full p-2 rounded bg-gray-900/50 text-gray-200 cursor-text">
                  <HighlightedPrompt prompt={prompt} variables={allAvailableVariables.map(v => v.replace(/^global\./, ''))} />
              </div>
            )}
          </div>
          <details className="mt-3 border-t border-gray-600 pt-2 text-sm">
            <summary className="cursor-pointer text-gray-400 font-semibold text-xs list-none flex items-center">
                Advanced Settings
                <svg className="w-4 h-4 ml-1 transform transition-transform details-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </summary>
            <div className="mt-3 space-y-4">
                <div>
                    <label htmlFor={`temp-${id}`} className="flex justify-between items-center text-xs text-gray-300 mb-1">
                        <span>Temperature</span>
                        <span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded">{temperature.toFixed(1)}</span>
                    </label>
                    <input id={`temp-${id}`} type="range" min="0" max="1" step="0.1" value={temperature} onChange={handleTemperatureChange} className="temp-slider"/>
                </div>
                 <div>
                    <label htmlFor={`think-${id}`} className="flex justify-between items-center text-xs text-gray-300">
                        <span>Thinking Mode</span>
                        <label className="toggle-switch">
                            <input id={`think-${id}`} type="checkbox" checked={thinkingEnabled} onChange={handleThinkingChange} />
                            <span className="toggle-slider"></span>
                        </label>
                    </label>
                </div>
            </div>
          </details>
          {allAvailableVariables.length > 0 && (
            <details className="mt-3 text-xs text-gray-400 shrink-0">
              <summary className="cursor-pointer font-semibold list-none flex items-center">
                Available variables
                <svg className="w-4 h-4 ml-1 transform transition-transform details-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </summary>
              <div className="flex flex-wrap gap-x-2 mt-2">
                {allAvailableVariables.map(v => <code key={v} className="bg-gray-600 rounded px-1 py-0.5">${v}</code>)}
              </div>
            </details>
          )}
        </div>
      </div>
      
      <Handle type="target" position={Position.Left} className="!bg-purple-400 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-purple-400 !w-3 !h-3" />
    </div>
  );
};

export default LlmNode;