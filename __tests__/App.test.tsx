// FIX: Add a triple-slash directive to explicitly include jest-dom type definitions.
/// <reference types="@testing-library/jest-dom" />

// FIX: Add jest imports
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';
import * as reactflow from 'reactflow';
import { CustomNode } from '../types';

// Mock the ReactFlow component and its hooks as they are complex dependencies
jest.mock('reactflow', () => ({
  // FIX: Cast the result of requireActual to object to fix spread operator error
  ...(jest.requireActual('reactflow') as object),
  ReactFlow: ({ children, onPaneContextMenu }: { children: React.ReactNode; onPaneContextMenu?: (e: any) => void }) => (
    <div data-testid="reactflow-canvas" onContextMenu={onPaneContextMenu}>{children}</div>
  ),
  useNodesState: jest.fn(),
  useEdgesState: jest.fn(),
  useReactFlow: jest.fn(),
  Controls: () => <div>Controls</div>,
  Background: () => <div>Background</div>,
  MiniMap: () => <div>MiniMap</div>,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock the geminiService as it's not directly used by App, but by child components
jest.mock('../services/geminiService', () => ({}));

const mockUseNodesState = reactflow.useNodesState as jest.Mock;
const mockUseEdgesState = reactflow.useEdgesState as jest.Mock;
const mockUseReactFlow = reactflow.useReactFlow as jest.Mock;
const mockSetNodes = jest.fn();
const mockSetEdges = jest.fn();
const mockAlert = jest.fn();

// FIX: Add a type for the flow file structure to avoid deep type inference issues.
// FIX: Use reactflow.Node[] instead of CustomNode[] to avoid type instantiation errors in tests.
// The complexity of CustomNode (`Node<DataA | DataB | ...>`) can cause issues for the TS compiler in a test environment with mocks.
interface FlowFile {
  nodes: reactflow.Node[];
  edges: reactflow.Edge[];
  name?: string;
  description?: string;
  globalVariables?: string;
}

describe('App', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockSetNodes.mockClear();
    mockSetEdges.mockClear();
    mockAlert.mockClear();
    
    // Provide a mock implementation for the hooks
    // FIX: Add explicit types to mock implementation to fix "Type instantiation is excessively deep" error.
    mockUseNodesState.mockImplementation((initialNodes: CustomNode[]) => [initialNodes, mockSetNodes, jest.fn()]);
    mockUseEdgesState.mockImplementation((initialEdges: reactflow.Edge[]) => [initialEdges, mockSetEdges, jest.fn()]);
    mockUseReactFlow.mockReturnValue({
        // FIX: Add type annotation to `pos` to prevent properties 'x' and 'y' not existing on type 'unknown'.
        screenToFlowPosition: jest.fn((pos: { x: number; y: number }) => ({ x: pos.x, y: pos.y })),
    });

    // Mock window.alert
    // FIX: Use 'window' instead of 'global' for browser APIs in a JSDOM environment.
    window.alert = mockAlert;

    // Mock Blob and URL for export test
    // FIX: Use 'window' instead of 'global' for browser APIs in a JSDOM environment.
    window.URL.createObjectURL = jest.fn(() => 'mock-url');
    // FIX: Use 'window' instead of 'global' for browser APIs in a JSDOM environment.
    window.URL.revokeObjectURL = jest.fn();
    // A simple mock for Blob
    // FIX: Use 'window' instead of 'global' for browser APIs in a JSDOM environment.
    // FIX: Add type to 'content' to resolve "Property 'join' does not exist on type 'unknown'".
    window.Blob = jest.fn((content: string[], _options) => ({
      content: content.join(''),
    })) as any;
  });

  describe('Core Functionality', () => {
    it('renders the Sidebar and a mock ReactFlow canvas', () => {
      render(<App />);
      expect(screen.getByText('Gemini Flow Canvas')).toBeInTheDocument(); // From Sidebar default state
      expect(screen.getByText('An interactive canvas to create and connect nodes.')).toBeInTheDocument();
      expect(screen.getByText('Controls')).toBeInTheDocument(); // From Mock ReactFlow
    });

    it('adds a new text node at click position via context menu', async () => {
      render(<App />);
      
      const canvas = screen.getByTestId('reactflow-canvas');
      fireEvent.contextMenu(canvas, { clientX: 123, clientY: 456 });

      const addNodeButton = await screen.findByText('Add Text Node');
      fireEvent.click(addNodeButton);

      expect(mockSetNodes).toHaveBeenCalledTimes(1);
      
      const setNodesUpdater = mockSetNodes.mock.calls[0][0] as (nodes: CustomNode[]) => CustomNode[];
      const initialNodes = mockUseNodesState.mock.calls[0][0] as CustomNode[];
      const newNodes = setNodesUpdater(initialNodes);
      
      expect(newNodes.length).toBe(initialNodes.length + 1);
      const addedNode = newNodes[newNodes.length - 1];
      expect(addedNode.type).toBe('textNode');
      expect(addedNode.data.label).toBe('New Text Node');
      expect(addedNode.position).toEqual({ x: 123, y: 456 });
    });
  });

  describe('Import/Export', () => {
    it('should trigger a JSON download with canvas metadata and globals when export is clicked from context menu', async () => {
      // Mocks for DOM manipulation in export
      const clickMock = jest.fn();
      const mockAnchor = { href: '', download: '', click: clickMock } as unknown as HTMLAnchorElement;
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
      const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

      render(<App />);
      const canvas = screen.getByTestId('reactflow-canvas');
      fireEvent.contextMenu(canvas);
      
      const exportButton = await screen.findByText('Export Canvas');
      fireEvent.click(exportButton);


      // Check blob creation and content
      expect(window.Blob).toHaveBeenCalledTimes(1);
      // FIX: Cast mock to 'any' to access 'content' property
      const blobInstance = (window.Blob as jest.Mock).mock.results[0].value as any;
      const exportedFlow = JSON.parse(blobInstance.content);
      
      // FIX: Update test to assert that canvas name and description are exported.
      expect(exportedFlow.name).toBe('Gemini Flow Canvas');
      expect(exportedFlow.description).toBe('An interactive canvas to create and connect nodes.');
      expect(typeof exportedFlow.globalVariables).toBe('string');
      expect(JSON.parse(exportedFlow.globalVariables)).toEqual({ user: { name: 'Alex' }, apiKey: 'your-secret-key-here'});
      expect(Array.isArray(exportedFlow.nodes)).toBe(true);
      expect(Array.isArray(exportedFlow.edges)).toBe(true);
      
      // Check DOM manipulation for download
      expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(appendChildSpy).toHaveBeenCalledWith(mockAnchor);
      expect(clickMock).toHaveBeenCalledTimes(1);
      expect(removeChildSpy).toHaveBeenCalledWith(mockAnchor);
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
      
      // Restore spies
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('should import a valid JSON file with metadata and globals and update state', async () => {
      // FIX: Use the `FlowFile` type to avoid deep type inference that causes TS errors.
      const validFlow: FlowFile = {
        name: 'Imported Flow Name',
        description: 'Imported flow description.',
        globalVariables: '{"imported": true}',
        // FIX: Cast node object to reactflow.Node to prevent deep type inference issues.
        nodes: [{ id: 'imported-1', type: 'textNode', position: { x: 0, y: 0 }, data: { label: 'Imported', text: 'Success' } } as reactflow.Node],
        edges: [],
      };
      const mockFile = new File([JSON.stringify(validFlow)], 'flow.json', { type: 'application/json' });

      render(<App />);
      
      // Check initial state
      expect(screen.getByText('Gemini Flow Canvas')).toBeInTheDocument();

      const fileInput = screen.getByTestId('import-input');
      await act(async () => { fireEvent.change(fileInput, { target: { files: [mockFile] } }); });
      
      await waitFor(() => {
          // Check nodes/edges update
          expect(mockSetNodes.mock.calls).toHaveLength(1);
          expect(mockSetNodes.mock.calls[0][0]).toMatchObject(validFlow.nodes);
          expect(mockSetEdges.mock.calls).toHaveLength(1);
          expect(mockSetEdges.mock.calls[0][0]).toMatchObject(validFlow.edges);
          // Check metadata update in UI
          expect(screen.getByText(validFlow.name!)).toBeInTheDocument();
          expect(screen.getByText(validFlow.description!)).toBeInTheDocument();
          
          // Check global variables update in UI
          // First, we need to open the collapsible panel
          const toggleButton = screen.getByRole('button', { name: 'Global Variables' });
          fireEvent.click(toggleButton);
          expect(screen.getByDisplayValue(validFlow.globalVariables!)).toBeInTheDocument();
      });
      expect(mockAlert).not.toHaveBeenCalled();
    });

    it('should import an old-format JSON file without metadata and not crash', async () => {
      // FIX: Use the `FlowFile` type to avoid deep type inference that causes TS errors.
      const oldFormatFlow: FlowFile = {
        // FIX: Cast node object to reactflow.Node to prevent deep type inference issues.
        nodes: [{ id: 'old-1', type: 'textNode', position: { x: 0, y: 0 }, data: { label: 'Old', text: 'Format' } } as reactflow.Node],
        edges: [],
      };
      const mockFile = new File([JSON.stringify(oldFormatFlow)], 'flow.json', { type: 'application/json' });

      render(<App />);
      
      // Check initial state
      const initialName = 'Gemini Flow Canvas';
      const initialDesc = 'An interactive canvas to create and connect nodes.';
      expect(screen.getByText(initialName)).toBeInTheDocument();
      expect(screen.getByText(initialDesc)).toBeInTheDocument();

      const fileInput = screen.getByTestId('import-input');
      await act(async () => { fireEvent.change(fileInput, { target: { files: [mockFile] } }); });
      
      await waitFor(() => {
          expect(mockSetNodes.mock.calls).toHaveLength(1);
          expect(mockSetNodes.mock.calls[0][0]).toMatchObject(oldFormatFlow.nodes);
          expect(mockSetEdges.mock.calls).toHaveLength(1);
          expect(mockSetEdges.mock.calls[0][0]).toMatchObject(oldFormatFlow.edges);
          // Check metadata has NOT changed
          expect(screen.getByText(initialName)).toBeInTheDocument();
          expect(screen.getByText(initialDesc)).toBeInTheDocument();
      });
      expect(mockAlert).not.toHaveBeenCalled();
    });

  });
});
