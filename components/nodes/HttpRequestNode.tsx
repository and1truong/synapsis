import React, { useState, useCallback, useMemo, useContext } from 'react';
import { Handle, Position, NodeProps, useReactFlow, Node, useEdges, useNodes, NodeResizer } from 'reactflow';
import { HttpRequestNodeData, TextNodeData, CustomNode } from '../../types';
import { findAncestors, sanitizeLabel, substituteVariables, getAvailableGlobalVariables } from './node-utils';
import { AppContext } from '../AppContext';

const METHODS_WITH_BODY = ['POST', 'PUT', 'PATCH'];

const HighlightedInput: React.FC<{
  value: string;
  variables: string[];
  Component: 'input' | 'textarea';
  wrapperClassName?: string;
  [key: string]: any; // for other props
}> = ({ value, variables, Component, wrapperClassName, ...props }) => {
  if (!variables.length || !value) return <Component value={value} {...props} />;

  const escapedVariables = variables.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(\\$(?:${escapedVariables.join('|')}))`, 'g');
  const parts = value.split(regex).filter(part => part);

  return (
    <div className={`relative ${wrapperClassName || ''}`}>
      <Component value={value} {...props} className={`${props.className} text-transparent caret-white`} />
      <div className="absolute top-0 left-0 right-0 bottom-0 p-2 pointer-events-none whitespace-pre-wrap">
        {parts.map((part, i) =>
          part.startsWith('$') && variables.includes(part.slice(1)) ? (
            <span key={i} className="bg-green-900 ring-1 ring-green-600 rounded px-1 py-0.5 font-mono">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </div>
    </div>
  );
};

const HttpRequestNode: React.FC<NodeProps<HttpRequestNodeData>> = ({ id, data, selected }) => {
  const { setNodes, addNodes, addEdges, getNode } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes() as CustomNode[];
  const { globals } = useContext(AppContext);

  // Component state for inputs
  const [label, setLabel] = useState(data.label);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [method, setMethod] = useState(data.method);
  const [url, setUrl] = useState(data.url);
  const [headers, setHeaders] = useState(data.headers);
  const [body, setBody] = useState(data.body);

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
    return [...new Set([...availableLocalVariables, ...availableGlobalVariables])];
  }, [availableLocalVariables, availableGlobalVariables]);


  const updateNodeData = useCallback(<K extends keyof HttpRequestNodeData>(key: K, value: HttpRequestNodeData[K]) => {
    setNodes((nds) =>
      nds.map((node: Node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, [key]: value } };
        }
        return node;
      })
    );
  }, [id, setNodes]);

  const handleHeaderBlur = () => {
    updateNodeData('label', label);
    setIsEditingHeader(false);
  };
  
  const handleUrlBlur = () => updateNodeData('url', url);
  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMethod = e.target.value as HttpRequestNodeData['method'];
    setMethod(newMethod);
    updateNodeData('method', newMethod);
  }
  const handleHeadersBlur = () => updateNodeData('headers', headers);
  const handleBodyBlur = () => updateNodeData('body', body);

  const runRequest = async () => {
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
    
    const finalUrl = substituteVariables(url, replacements, globals);
    const finalHeaders = substituteVariables(headers, replacements, globals);
    const finalBody = substituteVariables(body, replacements, globals);

    const newNodeId = `textnode_${id}_${Date.now()}`;
    const newTextNode: Node<TextNodeData> = {
      id: newNodeId,
      type: 'textNode',
      position: { x: parentNode.position.x + (parentNode.width ?? 352) + 100, y: parentNode.position.y },
      data: { label: 'HTTP Response', text: '⏳ Sending...' },
      style: { width: 320, height: 200 },
    };
    addNodes(newTextNode);

    const newEdge = { id: `edge-${id}-${newNodeId}`, source: id, target: newNodeId, animated: true, style: { stroke: '#10b981' } };
    addEdges(newEdge);

    try {
      const headerEntries = finalHeaders.split('\n').reduce((acc, line) => {
        const [key, ...value] = line.split(':');
        if (key && value.length > 0) {
          acc[key.trim()] = value.join(':').trim();
        }
        return acc;
      }, {} as Record<string, string>);

      const fetchOptions: RequestInit = {
        method: method,
        headers: headerEntries,
      };

      if (METHODS_WITH_BODY.includes(method)) {
        fetchOptions.body = finalBody;
      }

      const response = await fetch(finalUrl, fetchOptions);
      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}\n\n${responseText}`);
      }

      let formattedText = responseText;
      try {
        const json = JSON.parse(responseText);
        formattedText = JSON.stringify(json, null, 2);
      } catch (e) {
        // Not a JSON response, just use the raw text
      }
      
      setNodes(nds => nds.map(n => n.id === newNodeId ? { ...n, data: { ...n.data, text: formattedText } } : n));

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setNodes(nds => nds.map(n => n.id === newNodeId ? { ...n, data: { ...n.data, text: `Error: ${errorMessage}` } } : n));
    } finally {
      updateNodeData('isLoading', false);
      addEdges({ ...newEdge, animated: false });
    }
  };

  return (
    <div className="bg-gray-700 border-2 border-green-500 rounded-lg shadow-xl text-white fade-in flex flex-col h-full overflow-hidden">
      <style>{`
        details[open] > summary .details-arrow {
          transform: rotate(180deg);
        }
      `}</style>
      <NodeResizer 
        isVisible={selected}
        minWidth={384}
        minHeight={300}
        lineClassName="border-green-500"
        handleClassName="bg-green-500 w-2 h-2 rounded-full"
      />
      <div className="bg-gray-800 px-4 py-2 rounded-t-lg font-bold flex justify-between items-center text-gray-300 shrink-0">
        <div className="flex-grow cursor-pointer" onDoubleClick={() => setIsEditingHeader(true)}>
          {isEditingHeader ? (
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleHeaderBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') handleHeaderBlur(); }}
              autoFocus
              className="bg-gray-700 text-white p-0 m-0 border-none focus:outline-none focus:ring-1 focus:ring-green-500 rounded w-full"
            />
          ) : (
            <span>{data.label}</span>
          )}
        </div>
        <button
          onClick={runRequest}
          disabled={data.isLoading}
          className="ml-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white text-xs font-bold py-1 px-3 rounded-md transition-colors shrink-0"
        >
          {data.isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
      
      <div className="p-4 space-y-3 flex-grow flex flex-col overflow-y-auto">
        <div className="flex items-center space-x-2">
          <select 
            value={method}
            onChange={handleMethodChange}
            className="bg-gray-800 border border-gray-500 rounded-md p-2 font-semibold focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
            <option>DELETE</option>
          </select>
          <div className="flex-grow">
            <HighlightedInput
              Component="input"
              type="text"
              value={url}
              variables={allAvailableVariables}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="https://api.example.com/data"
              className="w-full p-2 bg-gray-800 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400">HEADERS</label>
           <HighlightedInput
              Component="textarea"
              value={headers}
              variables={allAvailableVariables}
              onChange={(e) => setHeaders(e.target.value)}
              onBlur={handleHeadersBlur}
              className="mt-1 w-full h-20 p-2 bg-gray-800 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-mono resize-none"
              placeholder={'Content-Type: application/json\nAuthorization: Bearer $global.apiKey'}
            />
        </div>

        {METHODS_WITH_BODY.includes(method) && (
          <div className="flex flex-col flex-grow">
            <label className="text-xs font-semibold text-gray-400">BODY</label>
            <HighlightedInput
              Component="textarea"
              value={body}
              variables={allAvailableVariables}
              onChange={(e) => setBody(e.target.value)}
              onBlur={handleBodyBlur}
              wrapperClassName="flex-grow"
              className="mt-1 w-full h-full p-2 bg-gray-800 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-mono resize-none"
              placeholder={'{\n  "key": "value",\n  "message": "$MyMessage"\n}'}
            />
          </div>
        )}
        
        {allAvailableVariables.length > 0 && (
          <details className="pt-2 text-xs text-gray-400 border-t border-gray-600">
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
      
      <Handle type="target" position={Position.Left} className="!bg-green-400 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-green-400 !w-3 !h-3" />
    </div>
  );
};

export default HttpRequestNode;