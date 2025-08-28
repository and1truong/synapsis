import React from 'react';

interface SidebarProps {
  isVisible: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isVisible }) => {
  return (
    <aside className={`bg-gray-900 border-r border-gray-700 flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
      isVisible ? 'w-72 p-4' : 'w-0 p-0 border-none'
    }`}>
      {/* Wrapper to prevent content reflow during animation */}
      <div className="w-64 flex flex-col h-full">
        <h1
          className="text-2xl font-bold text-gray-200 mb-4 whitespace-nowrap"
        >
          Gemini Flow
        </h1>
        
        <div className="flex-grow">
          {/* Content removed and moved to panels */}
        </div>
        
         <div className="mt-auto pt-4 border-t border-gray-700 text-xs text-gray-500 space-y-1 shrink-0 whitespace-nowrap">
          <p className="font-semibold">Quick Tips:</p>
          <p>• Use `$NodeLabel` for local variables.</p>
          <p>• Use `$global.path.to.value` for global variables.</p>
          <p>• Double-click headers or content to edit.</p>
          <p>• Connect nodes by dragging handles.</p>
          <p>• Click the arrow to toggle this sidebar.</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;