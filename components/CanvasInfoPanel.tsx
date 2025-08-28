import React, { useState } from 'react';

interface CanvasInfoPanelProps {
  canvasName: string;
  canvasDescription: string;
  setCanvasName: (name: string) => void;
  setCanvasDescription: (description: string) => void;
}

const CanvasInfoPanel: React.FC<CanvasInfoPanelProps> = ({
  canvasName,
  canvasDescription,
  setCanvasName,
  setCanvasDescription,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isDescriptionVisible, setIsDescriptionVisible] = useState(true);

  return (
    <div className="bg-gray-900/80 p-3 rounded-lg border border-gray-700 shadow-xl backdrop-blur-sm max-w-xs text-gray-200 w-72">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => !isEditingName && setIsDescriptionVisible(!isDescriptionVisible)}
        title={isDescriptionVisible ? 'Click to hide description' : 'Click to show description'}
      >
        {isEditingName ? (
          <input
            value={canvasName}
            onChange={(e) => setCanvasName(e.target.value)}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setIsEditingName(false);
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="bg-gray-800 text-lg font-bold w-full focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded p-1 -m-1"
          />
        ) : (
          <h1
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditingName(true);
            }}
            className="text-lg font-bold hover:bg-gray-800 rounded p-1 -m-1 flex-grow truncate"
            title="Double-click to edit title"
          >
            {canvasName}
          </h1>
        )}
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 shrink-0 ml-2 ${
            isDescriptionVisible ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isDescriptionVisible && (
        <div id="canvas-description" className="mt-2 pt-2 border-t border-gray-700 fade-in">
          {isEditingDescription ? (
            <textarea
              value={canvasDescription}
              onChange={(e) => setCanvasDescription(e.target.value)}
              onBlur={() => setIsEditingDescription(false)}
              autoFocus
              className="bg-gray-800 text-sm text-gray-400 w-full focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded resize-none p-1 -m-1"
              rows={3}
            />
          ) : (
            <p
              onDoubleClick={() => setIsEditingDescription(true)}
              className="text-sm text-gray-400 cursor-pointer hover:bg-gray-800 rounded p-1 -m-1"
              title="Double-click to edit description"
            >
              {canvasDescription || 'Double-click to add a description.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CanvasInfoPanel;