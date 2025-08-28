import React, { useState } from 'react';

interface GlobalVariablesPanelProps {
  globalVariables: string;
  setGlobalVariables: (vars: string) => void;
}

const GlobalVariablesPanel: React.FC<GlobalVariablesPanelProps> = ({
  globalVariables,
  setGlobalVariables,
}) => {
  const [isOpen, setIsOpen] = useState(false); // Collapsed by default

  return (
    <div className="bg-gray-900/80 p-3 rounded-lg border border-gray-700 shadow-xl backdrop-blur-sm w-72 text-gray-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center text-lg font-semibold focus:outline-none"
        aria-expanded={isOpen}
        aria-controls="global-vars-panel-content"
      >
        <span>Global Variables</span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div id="global-vars-panel-content" className="mt-2 pt-2 border-t border-gray-700 fade-in">
          <textarea
            value={globalVariables}
            onChange={(e) => setGlobalVariables(e.target.value)}
            className="w-full h-32 p-2 bg-gray-800 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-mono resize-y"
            placeholder='{ "apiKey": "..." }'
            spellCheck="false"
          />
        </div>
      )}
    </div>
  );
};

export default GlobalVariablesPanel;