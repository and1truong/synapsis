

import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow, Node, NodeResizer } from 'reactflow';
import { TextNodeData } from '../../types';

const TextNode: React.FC<NodeProps<TextNodeData>> = ({ id, data, selected }) => {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.text);
  
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [label, setLabel] = useState(data.label);

  const onTextChange = useCallback((evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(evt.target.value);
  }, []);

  // FIX: Use an updater function for setNodes to ensure atomic updates and align with test assumptions.
  const updateNodeText = useCallback(() => {
    setNodes((nodes) =>
      nodes.map((node: Node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, text } };
        }
        return node;
      })
    );
  }, [id, text, setNodes]);
  
  // FIX: Use an updater function for setNodes to ensure atomic updates and align with test assumptions.
  const updateNodeLabel = useCallback(() => {
    setNodes((nodes) =>
      nodes.map((node: Node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, label } };
        }
        return node;
      })
    );
  }, [id, label, setNodes]);
  
  const handleDoubleClick = () => {
    setIsEditing(true);
  };
  
  const handleBlur = () => {
    updateNodeText();
    setIsEditing(false);
  };

  const handleHeaderBlur = () => {
    updateNodeLabel();
    setIsEditingHeader(false);
  };

  const handleHeaderKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (evt.key === 'Enter') {
      handleHeaderBlur();
    }
  };

  return (
    <div className="bg-gray-700 border-2 border-gray-600 rounded-lg shadow-xl text-white fade-in flex flex-col h-full overflow-hidden">
      <NodeResizer 
        isVisible={selected}
        minWidth={200}
        minHeight={150}
        lineClassName="border-cyan-400"
        handleClassName="bg-cyan-400 w-2 h-2 rounded-full"
      />
      <div 
        className="bg-gray-800 px-4 py-2 rounded-t-lg font-bold text-gray-300 cursor-pointer shrink-0"
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
            className="bg-gray-700 text-white p-0 m-0 border-none focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded w-full"
          />
        ) : (
          data.label
        )}
      </div>
      <div className="p-4 flex-grow" onDoubleClick={handleDoubleClick}>
        {isEditing ? (
          <textarea
            value={text}
            onChange={onTextChange}
            onBlur={handleBlur}
            autoFocus
            className="w-full h-full p-2 bg-gray-800 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm resize-none"
          />
        ) : (
          <div className="text-sm whitespace-pre-wrap h-full text-gray-200">{text || 'Double-click to edit...'}</div>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!bg-cyan-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-cyan-500 !w-3 !h-3" />
    </div>
  );
};

export default TextNode;