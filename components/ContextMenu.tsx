import React from 'react';

interface ContextMenuProps {
  top: number;
  left: number;
  onClick: () => void;
  onAddNode: (type: 'textNode' | 'llmNode' | 'httpRequestNode') => void;
  onExport: () => void;
  onImport: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ top, left, onClick, onAddNode, onExport, onImport }) => {
  const createAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
    onClick();
  };

  return (
    <div
      style={{ top, left }}
      className="absolute z-50 bg-gray-800 border border-gray-600 rounded-md shadow-lg text-white text-sm py-1 w-56 fade-in"
      onContextMenu={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <div
        className="px-3 py-1.5 hover:bg-gray-700 cursor-pointer"
        onClick={createAction(() => onAddNode('textNode'))}
      >
        Add Text Node
      </div>
      <div
        className="px-3 py-1.5 hover:bg-gray-700 cursor-pointer"
        onClick={createAction(() => onAddNode('httpRequestNode'))}
      >
        Add HTTP Request Node
      </div>
      <div
        className="px-3 py-1.5 hover:bg-gray-700 cursor-pointer"
        onClick={createAction(() => onAddNode('llmNode'))}
      >
        Add LLM Node
      </div>
      <div className="my-1 border-t border-gray-700" />
      <div
        className="px-3 py-1.5 hover:bg-gray-700 cursor-pointer"
        onClick={createAction(onExport)}
      >
        Export Canvas
      </div>
      <div
        className="px-3 py-1.5 hover:bg-gray-700 cursor-pointer"
        onClick={createAction(onImport)}
      >
        Import Canvas
      </div>
    </div>
  );
};

export default ContextMenu;
