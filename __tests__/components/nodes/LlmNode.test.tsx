// FIX: Add a triple-slash directive to explicitly include jest-dom type definitions.
/// <reference types="@testing-library/jest-dom" />

// FIX: Add jest imports
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LlmNode from '../../../components/nodes/LlmNode';
// FIX: Import Position and NodeProps
import { ReactFlowProvider, useReactFlow, useEdges, Position, NodeProps, Node } from 'reactflow';
import * as geminiService from '../../../services/geminiService';
// FIX: Import LlmNodeData
import { LlmNodeData } from '../../../types';

// Mock React Flow hooks
jest.mock('reactflow', () => ({
  // FIX: Cast the result of requireActual to object to fix spread operator error
  ...(jest.requireActual('reactflow') as object),
  useReactFlow: jest.fn(),
  useEdges: jest.fn(),
  useNodes: jest.fn(),
}));

// Mock Gemini Service
jest.mock('../../../services/geminiService', () => ({
  generateTextStream: jest.fn(),
}));

const mockUseReactFlow = useReactFlow as jest.Mock;
const mockUseEdges = useEdges as jest.Mock;
const mockUseNodes = (jest.requireMock('reactflow') as any).useNodes as jest.Mock;
const mockGenerateTextStream = geminiService.generateTextStream as jest.Mock;

const mockSetNodes = jest.fn();
const mockAddNodes = jest.fn();
const mockAddEdges = jest.fn();
const mockGetNode = jest.fn();

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<ReactFlowProvider>{ui}</ReactFlowProvider>);
};

describe('LlmNode', () => {
  // FIX: use Position enum and type props with NodeProps
  const nodeProps: NodeProps<LlmNodeData> = {
    id: 'llm-node-1',
    data: { label: 'My LLM', prompt: 'Explain $Concept', isLoading: false, temperature: 0.7, thinkingEnabled: true },
    selected: false, isConnectable: true, dragging: false,
    targetPosition: Position.Left, sourcePosition: Position.Right,
    xPos: 200, yPos: 200, type: 'llmNode', zIndex: 0
  };
  
  const sourceNode = {
      id: 'text-node-1',
      type: 'textNode',
      data: { label: 'Concept', text: 'Quantum Physics' },
      position: { x: 0, y: 0 }
  };
  
  const mockEdges = [{ id: 'e1', source: sourceNode.id, target: nodeProps.id }];
  const mockAllNodes = [
      {...nodeProps, data: { ...nodeProps.data }},
      sourceNode
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReactFlow.mockReturnValue({
      setNodes: mockSetNodes,
      addNodes: mockAddNodes,
      addEdges: mockAddEdges,
      getNode: mockGetNode,
    });
    mockUseNodes.mockReturnValue(mockAllNodes);
    mockGetNode.mockImplementation((id: string) => {
        if (id === nodeProps.id) return { ...nodeProps, position: { x: 200, y: 200 }, width: 320 };
        if (id === sourceNode.id) return sourceNode;
        return undefined;
    });
    mockUseEdges.mockReturnValue(mockEdges);
  });

  it('renders label and prompt', () => {
    renderWithProvider(<LlmNode {...nodeProps} />);
    expect(screen.getByText('My LLM')).toBeInTheDocument();
    expect(screen.getByText('Explain $Concept')).toBeInTheDocument();
  });

  it('displays available variables from connected nodes', () => {
    renderWithProvider(<LlmNode {...nodeProps} />);
    expect(screen.getByText('Available variables:')).toBeInTheDocument();
    expect(screen.getByText('$Concept')).toBeInTheDocument();
  });

  it('calls geminiService with default settings and creates new nodes/edges on Run', async () => {
    // Mock the async generator
    async function* mockStream() {
      yield 'Quantum';
      yield ' computing is...';
    }
    mockGenerateTextStream.mockReturnValue(mockStream());
    
    renderWithProvider(<LlmNode {...nodeProps} />);
    const runButton = screen.getByRole('button', { name: 'Run' });

    await act(async () => {
      fireEvent.click(runButton);
    });
    
    // 1. Check if loading state was set
    expect(mockSetNodes).toHaveBeenCalled();

    // 2. Check if prompt was correctly substituted and sent to service with config
    expect(mockGenerateTextStream).toHaveBeenCalledWith(
        'Explain Quantum Physics',
        { temperature: 0.7, thinkingEnabled: true }
    );
    
    // 3. Check if a new node and edge were added
    expect(mockAddNodes).toHaveBeenCalledTimes(1);
    expect(mockAddEdges).toHaveBeenCalledTimes(1);
    expect(mockAddEdges.mock.calls[0][0]).toMatchObject({ animated: true });
    
    // 4. Check if content was streamed to the new node
    await waitFor(() => {
        const streamUpdateCalls = mockSetNodes.mock.calls.filter(call => {
            // FIX: Cast the updater to a function type to fix "not callable" error.
            const updater = call[0] as (nodes: Node[]) => Node[];
            // FIX: Use the actual added node to prevent type errors and fix test logic.
            const newNode = mockAddNodes.mock.calls[0][0] as Node;
            // This is a bit of a trick to inspect the updater function's behavior
            const result = updater([newNode]);
            return result[0]?.data.text.includes('Quantum');
        });
        expect(streamUpdateCalls.length).toBeGreaterThan(0);
    });

    // 5. Check if loading state was unset and edge animation stopped
    await waitFor(() => {
        expect(mockAddEdges).toHaveBeenCalledTimes(2);
        expect(mockAddEdges.mock.calls[1][0]).toMatchObject({ animated: false });
    });
    expect(screen.getByRole('button', { name: 'Run' })).not.toBeDisabled();
  });
  
  it('calls geminiService with updated settings when changed', async () => {
    async function* mockStream() { yield '...'; }
    mockGenerateTextStream.mockReturnValue(mockStream());
    
    renderWithProvider(<LlmNode {...nodeProps} />);

    // Open advanced settings
    fireEvent.click(screen.getByText('Advanced Settings'));

    // Change temperature
    const tempSlider = screen.getByLabelText(/Temperature/);
    fireEvent.change(tempSlider, { target: { value: '0.2' } });

    // Change thinking mode
    const thinkingToggle = screen.getByLabelText(/Thinking Mode/);
    fireEvent.click(thinkingToggle); // This will uncheck it

    const runButton = screen.getByRole('button', { name: 'Run' });
     await act(async () => {
      fireEvent.click(runButton);
    });

    expect(mockGenerateTextStream).toHaveBeenCalledWith(
        'Explain Quantum Physics',
        { temperature: 0.2, thinkingEnabled: false }
    );
  });

  it('handles errors from the streaming service gracefully', async () => {
    // FIX: The service should throw an error to test the component's catch block.
    mockGenerateTextStream.mockImplementation(async function* () {
      throw new Error('Something went wrong');
    });
    
    renderWithProvider(<LlmNode {...nodeProps} />);
    const runButton = screen.getByRole('button', { name: 'Run' });
    
    await act(async () => {
      fireEvent.click(runButton);
    });

    // Check that the error message is displayed in the new node
     await waitFor(() => {
        const updaterCall = mockSetNodes.mock.calls.find(call => {
            // FIX: Cast updater and use the actual new node to fix type errors and logic.
             const updater = call[0] as (nodes: Node[]) => Node[];
             const newNode = mockAddNodes.mock.calls[0][0] as Node;
             if (!newNode) return false;
             const result = updater([newNode]);
             return result[0]?.data.text?.includes('Error: Something went wrong');
        });
        expect(updaterCall).toBeDefined();
    });

    // Check loading state is reset
    expect(screen.getByRole('button', { name: 'Run' })).not.toBeDisabled();
  });
});